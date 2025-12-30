'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Crown, Shield, Search, Check } from 'lucide-react'

interface User {
  id: string
  email: string | null
  isPro: boolean
  createdAt: string
}

const ADMIN_EMAILS = ['myrahul.mohankumar@gmail.com']

export default function AdminPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  const isAdmin = user?.emailAddresses?.[0]?.emailAddress &&
    ADMIN_EMAILS.includes(user.emailAddresses[0].emailAddress)

  useEffect(() => {
    if (!isLoaded) return

    if (!isAdmin) {
      router.push('/dashboard')
      return
    }

    fetchUsers()
  }, [isLoaded, isAdmin, router])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePro = async (userId: string, currentStatus: boolean) => {
    setUpdating(userId)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isPro: !currentStatus }),
      })

      if (response.ok) {
        setUsers(users.map(u =>
          u.id === userId ? { ...u, isPro: !currentStatus } : u
        ))
      }
    } catch (error) {
      console.error('Failed to toggle pro:', error)
    } finally {
      setUpdating(null)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage user Pro status</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or ID..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-2xl font-bold text-foreground">{users.length}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-2xl font-bold text-amber-500">{users.filter(u => u.isPro).length}</p>
            <p className="text-sm text-muted-foreground">Pro Users</p>
          </div>
        </div>

        {/* User List */}
        <div className="space-y-2">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-border/80 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">
                    {u.email || 'No email'}
                  </p>
                  {u.isPro && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-xs font-medium">
                      <Crown className="h-3 w-3" />
                      PRO
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {u.id}
                </p>
              </div>

              <button
                onClick={() => togglePro(u.id, u.isPro)}
                disabled={updating === u.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  u.isPro
                    ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                } disabled:opacity-50`}
              >
                {updating === u.id ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : u.isPro ? (
                  <>
                    <Check className="h-4 w-4" />
                    Pro
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4" />
                    Make Pro
                  </>
                )}
              </button>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
