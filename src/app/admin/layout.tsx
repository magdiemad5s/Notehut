import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Shield, ArrowLeft } from 'lucide-react'

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
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Shield className="size-5" />
          <span className="font-semibold">Admin Panel</span>
          <Link
            href="/dashboard"
            className={
              buttonVariants({ variant: 'ghost', size: 'sm' }) + ' ml-auto'
            }
          >
            <ArrowLeft className="size-4" /> Back to App
          </Link>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
