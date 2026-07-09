import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminTabs } from '@/components/admin/admin-tabs'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) redirect('/')

  return <AdminTabs currentUserId={user.id} />
}
