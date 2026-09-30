'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/errors'
import { createUserAsAdmin } from '@/app/(auth)/signup/actions'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export function SignupForm() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successEmail, setSuccessEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setError('')
    setSuccessEmail('')

    // AUTH-004: validación de cliente, antes de llamar a la server action
    const cleanUsername = username.trim()
    if (!cleanUsername) {
      setError(reportError('AUTH-004'))
      return
    }

    // AUTH-006: validación de cliente, las contraseñas deben coincidir
    if (password !== confirmPassword) {
      setError(reportError('AUTH-006'))
      return
    }

    // AUTH-012: validación de cliente, mínimo 6 caracteres
    if (password.length < 6) {
      setError(reportError('AUTH-012'))
      return
    }

    setLoading(true)

    const result = await createUserAsAdmin({
      username: cleanUsername,
      email,
      password,
    })

    if (!result.ok) {
      // El detalle técnico ya se registró en el servidor (dentro de la action)
      setError(reportError(result.code))
      setLoading(false)
      return
    }

    setSuccessEmail(email.trim().toLowerCase())
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setLoading(false)
  }

  return (
    <form
      id="signup-form"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
    >
      {/* Nombre de usuario */}
      <div className="space-y-1.5">
        <label
          htmlFor="signup-username"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Nombre de usuario
        </label>
        <input
          id="signup-username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="peufeliz"
          required
          disabled={loading}
          className={cn(
            'w-full px-4 py-3.5 rounded-xl border-2 outline-none',
            'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
            'text-base font-medium',
            'transition-all duration-200',
            'border-zinc-800 focus:border-violet-500/60',
            'disabled:opacity-60'
          )}
        />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label
          htmlFor="signup-email"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Email
        </label>
        <input
          id="signup-email"
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
            'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
            'text-base font-medium',
            'transition-all duration-200',
            'border-zinc-800 focus:border-violet-500/60',
            'disabled:opacity-60'
          )}
        />
      </div>

      {/* Contraseña */}
      <div className="space-y-1.5">
        <label
          htmlFor="signup-password"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Contraseña
        </label>
        <div className="relative">
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
            className={cn(
              'w-full px-4 py-3.5 pr-12 rounded-xl border-2 outline-none',
              'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
              'text-base font-medium',
              'transition-all duration-200',
              'border-zinc-800 focus:border-violet-500/60',
              'disabled:opacity-60'
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
          htmlFor="signup-confirm-password"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Confirmar contraseña
        </label>
        <input
          id="signup-confirm-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={loading}
          className={cn(
            'w-full px-4 py-3.5 rounded-xl border-2 outline-none',
            'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
            'text-base font-medium',
            'transition-all duration-200',
            'border-zinc-800 focus:border-violet-500/60',
            'disabled:opacity-60'
          )}
        />
      </div>

      {/* Éxito */}
      {successEmail && (
        <div
          role="status"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm animate-fade-in"
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>Cuenta creada para {successEmail}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        id="btn-signup-submit"
        type="submit"
        disabled={loading || !username || !email || !password || !confirmPassword}
        className={cn(
          'w-full h-14 rounded-2xl text-base font-bold tracking-tight',
          'bg-violet-600 text-white',
          'transition-all duration-200 active:scale-[0.98]',
          'hover:bg-violet-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'shadow-lg shadow-violet-600/25',
          'flex items-center justify-center gap-2'
        )}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Creando cuenta…</span>
          </>
        ) : (
          'Crear cuenta'
        )}
      </button>
    </form>
  )
}
