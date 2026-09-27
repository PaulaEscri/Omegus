'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/errors'
import { acceptInvitation } from '@/app/(auth)/invitacion/actions'
import { Eye, EyeOff, Loader2, AlertCircle, Mail } from 'lucide-react'

type Phase = 'loading' | 'ready' | 'invalid'

export function InvitationForm() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [invalidError, setInvalidError] = useState('')
  const [email, setEmail] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()

    const init = async () => {
      const rawHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const params = new URLSearchParams(rawHash)

      const hashError = params.get('error') || params.get('error_description')
      if (hashError) {
        setInvalidError(reportError('AUTH-009', hashError))
        setPhase('invalid')
        return
      }

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        window.history.replaceState(null, '', window.location.pathname)
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setInvalidError(reportError('AUTH-009'))
        setPhase('invalid')
        return
      }

      if (user.user_metadata?.username) {
        router.replace('/dashboard')
        return
      }

      setEmail(user.email ?? '')
      setPhase('ready')
    }

    init()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanUsername = username.trim()
    if (!cleanUsername) {
      setError(reportError('AUTH-004'))
      return
    }

    if (password !== confirmPassword) {
      setError(reportError('AUTH-006'))
      return
    }

    setSubmitting(true)

    const result = await acceptInvitation({ username: cleanUsername, password })

    if (!result.ok) {
      setError(reportError(result.code))
      setSubmitting(false)
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <Loader2 size={28} className="animate-spin text-zinc-600" />
        <p className="text-sm text-zinc-500">Comprobando tu invitación…</p>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-4 animate-fade-in">
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm w-full">
          <AlertCircle size={16} className="shrink-0" />
          <span>{invalidError}</span>
        </div>
        <Link
          href="/login"
          className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          Volver a inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Email (solo lectura) */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Email
        </label>
        <div className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-xl border-2 border-zinc-800 bg-zinc-900/40 text-zinc-400 text-base font-medium">
          <Mail size={16} className="text-zinc-600 shrink-0" />
          <span className="truncate">{email}</span>
        </div>
      </div>

      {/* Nombre de usuario */}
      <div className="space-y-1.5">
        <label
          htmlFor="invitation-username"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Nombre de usuario
        </label>
        <input
          id="invitation-username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="peufeliz"
          required
          disabled={submitting}
          className={cn(
            'w-full px-4 py-3.5 rounded-xl border-2 outline-none',
            'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
            'text-base font-medium transition-all duration-200',
            'border-zinc-800 focus:border-violet-500/60 disabled:opacity-60'
          )}
        />
      </div>

      {/* Contraseña */}
      <div className="space-y-1.5">
        <label
          htmlFor="invitation-password"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Contraseña
        </label>
        <div className="relative">
          <input
            id="invitation-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={submitting}
            className={cn(
              'w-full px-4 py-3.5 pr-12 rounded-xl border-2 outline-none',
              'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
              'text-base font-medium transition-all duration-200',
              'border-zinc-800 focus:border-violet-500/60 disabled:opacity-60'
            )}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors p-1"
          >
            {showPassword
              ? <EyeOff size={18} strokeWidth={1.75} />
              : <Eye size={18} strokeWidth={1.75} />
            }
          </button>
        </div>
      </div>

      {/* Confirmar contraseña */}
      <div className="space-y-1.5">
        <label
          htmlFor="invitation-confirm-password"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Confirmar contraseña
        </label>
        <input
          id="invitation-confirm-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={submitting}
          className={cn(
            'w-full px-4 py-3.5 rounded-xl border-2 outline-none',
            'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
            'text-base font-medium transition-all duration-200',
            'border-zinc-800 focus:border-violet-500/60 disabled:opacity-60'
          )}
        />
      </div>

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
        disabled={submitting || !username || !password || !confirmPassword}
        className={cn(
          'w-full h-14 rounded-2xl text-base font-bold tracking-tight',
          'bg-violet-600 text-white transition-all duration-200 active:scale-[0.98]',
          'hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed',
          'shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2'
        )}
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Completando registro…</span>
          </>
        ) : (
          'Completar registro'
        )}
      </button>
    </form>
  )
}
