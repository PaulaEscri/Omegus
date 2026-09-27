'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Send, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/errors'
import { inviteUser } from '@/app/(app)/ajustes/usuarios/actions'

export function InviteUserForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successEmail, setSuccessEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setError('')
    setSuccessEmail('')
    setLoading(true)

    const result = await inviteUser(email)

    if (!result.ok) {
      setError(reportError(result.code))
      setLoading(false)
      return
    }

    setSuccessEmail(email.trim().toLowerCase())
    setEmail('')
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 p-5 space-y-4"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="invite-email"
            className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
          >
            Email a invitar
          </label>
          <input
            id="invite-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            disabled={loading}
            className={cn(
              'w-full px-4 py-3.5 rounded-xl border-2 outline-none',
              'bg-zinc-950/80 text-zinc-100 placeholder:text-zinc-700',
              'text-sm font-medium transition-all duration-200',
              'border-zinc-800 focus:border-violet-500/60 disabled:opacity-60'
            )}
          />
        </div>

        {successEmail && (
          <div
            role="status"
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm animate-fade-in"
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Invitación enviada a {successEmail}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl',
            'bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold',
            'transition-all duration-200 active:scale-[0.98] disabled:opacity-60'
          )}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Enviar invitación
        </button>
      </form>

      <Link
        href="/signup"
        className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <UserPlus size={13} />
        Crear cuenta directamente
      </Link>
    </div>
  )
}
