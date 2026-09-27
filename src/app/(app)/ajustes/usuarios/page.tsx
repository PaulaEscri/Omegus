import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getIsAdmin } from '@/lib/auth/admin'
import { InviteUserForm } from '@/components/ajustes/InviteUserForm'

export const metadata: Metadata = {
  title: 'Usuarios · Ajustes',
  description: 'Invita nuevas cuentas a la app.',
}

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = await getIsAdmin(supabase, user.id)
  if (!isAdmin) redirect('/ajustes')

  return (
    <div className="min-h-full bg-zinc-950">
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 px-5 py-4">
        <div className="flex items-center gap-3.5 max-w-md mx-auto">
          <Link
            href="/ajustes"
            id="btn-back-usuarios"
            aria-label="Volver a Ajustes"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all active:scale-95 shrink-0"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <Users size={16} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-50">Usuarios</h1>
              <p className="text-xs font-medium text-zinc-500">Invitar nuevas cuentas</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 pt-6 pb-8 max-w-md mx-auto">
        <InviteUserForm />
      </div>
    </div>
  )
}
