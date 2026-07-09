'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Shield, ShieldOff, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type User = {
  id: string
  email: string
  is_admin: boolean
  created_at: string
  document_count: number
}

type UsersResponse = {
  users: User[]
}

type Props = {
  currentUserId: string
}

/* -------------------------------------------------------------------------- */
/*  Status badge helpers                                                      */
/* -------------------------------------------------------------------------- */

const adminBadgeConfig: Record<string, { label: string; className: string }> = {
  admin: { label: 'Admin', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  user:  { label: 'User',  className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
}

function AdminBadge({ isAdmin }: { isAdmin: boolean }) {
  const cfg = isAdmin ? adminBadgeConfig.admin : adminBadgeConfig.user
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Date formatting                                                           */
/* -------------------------------------------------------------------------- */

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/* -------------------------------------------------------------------------- */
/*  UsersSection                                                              */
/* -------------------------------------------------------------------------- */

export function UsersSection({ currentUserId }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  /* ------ Fetch users ------ */

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to load users (${res.status})`)
      }
      const data: UsersResponse = await res.json()
      setUsers(data.users)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  /* ------ Admin toggle ------ */

  const handleAdminToggle = useCallback(
    async (userId: string, currentlyAdmin: boolean) => {
      setTogglingId(userId)
      try {
        const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, isAdmin: !currentlyAdmin }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to update user')
        }

        toast.success(
          currentlyAdmin
            ? 'Admin privileges removed'
            : 'Admin privileges granted',
        )
        await fetchUsers()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update user')
      } finally {
        setTogglingId(null)
      }
    },
    [fetchUsers],
  )

  /* ------ Derived values ------ */

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const adminCount = users.filter((u) => u.is_admin).length

  /* ------ Render ------ */

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" />
          User Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {users.length} total users, {adminCount} admin{adminCount !== 1 ? 's' : ''}
        </p>
      </CardHeader>

      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Loading users&hellip;
          </div>
        ) : filteredUsers.length === 0 ? (
          /* Empty state */
          <div className="py-8 text-center text-muted-foreground">
            {searchQuery
              ? 'No users matching your search'
              : 'No users found'}
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Documents</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="max-w-[250px] truncate px-4 py-3">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge isAdmin={user.is_admin} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.document_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {user.id === currentUserId ? (
                        <span
                          className="inline-flex cursor-not-allowed items-center gap-1 text-xs text-muted-foreground"
                          title="You cannot change your own admin status"
                        >
                          <Shield className="size-3.5" />
                          Cannot change
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={user.is_admin ? 'destructive' : 'default'}
                          onClick={() =>
                            handleAdminToggle(user.id, user.is_admin)
                          }
                          disabled={togglingId !== null}
                        >
                          {togglingId === user.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : user.is_admin ? (
                            <ShieldOff className="size-3.5" />
                          ) : (
                            <Shield className="size-3.5" />
                          )}
                          {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
