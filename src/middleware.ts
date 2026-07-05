import { updateSession } from '@/lib/supabase/middleware'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/chat/:path*',
    '/documents/:path*',
    '/topics/:path*',
    '/weaknesses/:path*',
    '/settings/:path*',
    '/admin/:path*',
  ],
}
