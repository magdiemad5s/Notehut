import 'server-only'

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { Agent, buildConnector } from 'undici'

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return true
  }

  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateIp(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0]
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized)
  if (isIP(normalized) !== 6) return true

  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true

  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false
}

/**
 * Reject URLs that can target local, link-local, metadata, or private services.
 * Private hosts are allowed only when explicitly enabled for a local,
 * self-hosted deployment. Never enable that escape hatch on a public server.
 */
export async function assertSafeOutboundUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid upstream URL')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only credential-free HTTP(S) upstream URLs are allowed')
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!hostname || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private upstream hosts are not allowed')
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true })

  if (addresses.length === 0) throw new Error('Upstream host could not be resolved')

  const allowPrivateUpstream = process.env.ALLOW_PRIVATE_AI_UPSTREAMS === 'true'

  if (!allowPrivateUpstream && addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Private upstream hosts are not allowed')
  }

  return url
}

type ValidatedDestination = {
  url: URL
  addresses: Array<{ address: string; family: number }>
}

async function validateDestination(rawUrl: string): Promise<ValidatedDestination> {
  const url = await assertSafeOutboundUrl(rawUrl)
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true })

  // Validate the exact second lookup that will be pinned into the connector.
  // The earlier URL validation lookup cannot be reused because DNS may change.
  if (
    process.env.ALLOW_PRIVATE_AI_UPSTREAMS !== 'true' &&
    addresses.some(({ address }) => isPrivateIp(address))
  ) {
    throw new Error('Private upstream hosts are not allowed')
  }
  return { url, addresses }
}

/**
 * Fetch through a connector pinned to the IP addresses validated immediately
 * before the request. Redirects are followed only after validating and pinning
 * the next destination as well, closing DNS-rebinding and redirect SSRF gaps.
 */
export async function safeServerFetch(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  const request = input instanceof Request ? input : null
  let currentUrl = request?.url ?? input.toString()
  let method = (init.method ?? request?.method ?? 'GET').toUpperCase()
  let body = init.body ?? (request && !['GET', 'HEAD'].includes(method) ? request.body : undefined)
  const headers = new Headers(request?.headers)
  new Headers(init.headers).forEach((value, key) => headers.set(key, value))

  for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
    const { url, addresses } = await validateDestination(currentUrl)
    let addressIndex = 0
    const connector = buildConnector({
      lookup: (_hostname, _options, callback) => {
        const address = addresses[addressIndex++ % addresses.length]
        callback(null, address.address, address.family)
      },
    })
    const dispatcher = new Agent({ connect: connector })

    const response = await fetch(url, {
      ...init,
      headers,
      method,
      body,
      redirect: 'manual',
      // Node's fetch supports Undici dispatchers; this property is not part
      // of the browser RequestInit type used by TypeScript.
      dispatcher,
    } as RequestInit & { dispatcher: Agent })

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.body) {
        await dispatcher.close()
        return response
      }

      const reader = response.body.getReader()
      const bodyStream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const result = await reader.read()
            if (result.done) {
              controller.close()
              await dispatcher.close()
            } else {
              controller.enqueue(result.value)
            }
          } catch (error) {
            controller.error(error)
            await dispatcher.destroy(error instanceof Error ? error : null)
          }
        },
        async cancel(reason) {
          await reader.cancel(reason)
          await dispatcher.close()
        },
      })
      return new Response(bodyStream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    }

    await response.body?.cancel()
    await dispatcher.close()
    const location = response.headers.get('location')
    if (!location || redirectCount === 3) {
      throw new Error('Upstream redirect could not be followed safely')
    }
    currentUrl = new URL(location, url).toString()
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
      method = 'GET'
      body = undefined
    } else if (body) {
      throw new Error('A request body cannot be replayed across an upstream redirect')
    }
  }

  throw new Error('Too many upstream redirects')
}
