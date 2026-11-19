import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIsAdmin } from '@/lib/auth/admin'
import { getSessionUser } from '@/lib/auth/session'
import { AdminUsers, type AdminUserRow } from '@/components/admin/AdminUsers'

export const metadata: Metadata = {
  title: 'Panel de Admin · Finanzas',
  robots: 'noindex, nofollow',
}

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  username: string | null
  email: string
  is_admin: boolean | null
  created_at: string
}

export default async function AdminPage() {
  const supabase = await createClient()
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // profiles.is_admin: única fuente de verdad
  if (!(await getIsAdmin(supabase, user.id))) redirect('/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('profiles')
    .select('id, username, email, is_admin, created_at')
    .order('created_at', { ascending: false })

  const users: AdminUserRow[] = ((data ?? []) as ProfileRow[]).map((p) => ({
    id: p.id,
    username: p.username,
    email: p.email,
    isAdmin: p.is_admin === true,
    createdAt: p.created_at,
  }))

  return (
    <div className="min-h-full bg-zinc-950">
      <header className="app-sticky-header sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 px-5 pb-4">
        <div className="flex items-center gap-3.5 max-w-md mx-auto">
          <Link
            href="/ajustes"
            aria-label="Volver a Ajustes"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all active:scale-95 shrink-0"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-50">Panel de Admin</h1>
              <p className="text-xs font-medium text-zinc-500">Gestión de usuarios</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 pt-6 pb-8 max-w-md mx-auto">
        <AdminUsers users={users} currentUserId={user.id} />
      </div>
    </div>
  )
}
