'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('Sign out error:', error.message)
        setLoading(false)
        return
      }

      router.refresh()
      router.push('/login')
    } catch (err) {
      console.error('Unexpected sign out error:', err)
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      aria-label={loading ? 'Signing out' : 'Sign out'}
      aria-busy={loading}
      title={loading ? 'Signing out' : 'Sign out'}
      className={cn(
        buttonVariants({ variant: 'ghost' }),
        'ml-auto size-11 shrink-0 cursor-pointer px-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-auto sm:px-3',
      )}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      <span className="sr-only sm:not-sr-only">
        {loading ? 'Signing out...' : 'Sign out'}
      </span>
    </button>
  )
}
