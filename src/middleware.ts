import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = await updateSession(request)
  if (!response.headers.get('location') &&
    request.nextUrl.pathname.startsWith('/api/') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  ) {
    const origin = request.headers.get('origin')
    const fetchSite = request.headers.get('sec-fetch-site')
    if (
      (origin && origin !== request.nextUrl.origin) ||
      fetchSite === 'cross-site'
    ) {
      response = NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }
  }

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  )
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
