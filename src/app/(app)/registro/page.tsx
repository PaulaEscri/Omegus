import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Registrar',
  description: 'Registra un nuevo ingreso, gasto o ahorro.',
}

export default async function RegistroPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-full bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 px-5 py-4">
        <div className="flex items-center gap-3.5 max-w-md mx-auto">
          <Link
            href="/dashboard"
            id="btn-back-registro"
            aria-label="Volver al dashboard"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all active:scale-95 shrink-0"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-50">Registrar actividad</h1>
            <p className="text-xs font-medium text-zinc-500">Ingreso · Gasto · Ahorro / Inversión</p>
          </div>
        </div>
      </header>


      {/* Formulario */}
      <div className="px-4 pt-5 max-w-md mx-auto">
        <TransactionForm userId={user.id} />
      </div>
    </div>
  )
}
