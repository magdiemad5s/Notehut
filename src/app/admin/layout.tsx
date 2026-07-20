import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Shield, ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) redirect('/')

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-40 border-b bg-background/90 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <nav aria-label="Admin navigation" className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            aria-label="NoteHut dashboard"
            className="shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BrandMark iconClassName="size-8 sm:size-9" wordmarkClassName="hidden sm:inline" />
          </Link>
          <div className="h-7 w-px shrink-0 bg-border" aria-hidden="true" />
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold sm:text-base">
              <Shield className="size-4 text-primary" aria-hidden="true" />
              Admin
            </span>
            <p className="hidden truncate text-xs text-muted-foreground md:block">Workspace controls and access</p>
          </div>
          <Link
            href="/dashboard"
            className={
              buttonVariants({ variant: 'ghost', size: 'sm' }) +
              ' ml-auto size-10 shrink-0 px-0 text-muted-foreground sm:h-8 sm:w-auto sm:px-2.5'
            }
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Back to app</span>
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
