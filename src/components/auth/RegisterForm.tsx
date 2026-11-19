'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/errors'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

const inputClass = cn(
  'w-full px-4 py-3.5 rounded-xl border-2 outline-none',
  'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
  'text-base font-medium transition-all duration-200',
  'border-zinc-800 focus:border-violet-500/60 disabled:opacity-60'
)
const labelClass =
  'block text-xs font-semibold text-zinc-500 uppercase tracking-wider'

export function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(reportError('AUTH-006'))
      return
    }
    if (password.length < 6) {
      setError(reportError('AUTH-012'))
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signUpError) {
        const code = (signUpError as { code?: string }).code
        if (code === 'user_already_exists') setError(reportError('AUTH-010'))
        else if (code === 'weak_password') setError(reportError('AUTH-012'))
        else setError(reportError('AUTH-003', signUpError))
        setLoading(false)
        return
      }

      // Sin confirmación por correo, signUp devuelve sesión. Si no la hay
      // (confirmación activada o email ya existente), no se puede entrar.
      if (!data.session) {
        setError(reportError('AUTH-003', 'signUp sin sesión'))
        setLoading(false)
        return
      }

      router.replace('/')
      router.refresh()
    } catch (err: unknown) {
      setError(reportError('AUTH-001', err))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="register-email" className={labelClass}>Email</label>
        <input
          id="register-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          disabled={loading}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="register-password" className={labelClass}>Contraseña</label>
        <div className="relative">
          <input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
            className={cn(inputClass, 'pr-12')}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors p-1"
          >
            {showPassword
              ? <EyeOff size={18} strokeWidth={1.75} />
              : <Eye size={18} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="register-confirm" className={labelClass}>Confirmar contraseña</label>
        <input
          id="register-confirm"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={loading}
          className={inputClass}
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
        disabled={loading || !email || !password || !confirmPassword}
        className={cn(
          'w-full h-14 rounded-2xl text-base font-bold tracking-tight',
          'bg-violet-600 text-white transition-all duration-200 active:scale-[0.98]',
          'hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed',
          'shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2'
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
