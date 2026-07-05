import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS.
 *
 * Used by:
 * - Admin routes (queue, settings, fallback-keys) — Phase 12
 * - Public-grade route (fallback keys from app_secrets) — Phase 11
 *
 * CRITICAL: Never expose this client to the browser. Only use in
 * server-side API routes that require privileged access.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}
