'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'

// Mensaje genérico: nunca revelar si el usuario existe o no (prevención de enumeración)
const GENERIC_ERROR = 'Credenciales incorrectas. Verifica tu usuario/email y contraseña.'

export function LoginForm() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier || !password) return

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()

      // Sanitización: trim + lowercase para normalizar (previene variantes de mayúsculas)
      const cleanInput = identifier.trim().toLowerCase()
      let targetEmail = cleanInput

      // Si no contiene '@' → el usuario ha introducido un username, hay que resolver el email
      if (!cleanInput.includes('@')) {
        // 1ª búsqueda: por username exacto — consulta parametrizada con .eq(), nunca interpolada
        const { data: byUsername } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', cleanInput)
          .maybeSingle()

        let resolvedEmail = (byUsername as { email: string } | null)?.email ?? null

        // 2ª búsqueda (fallback): por prefijo de email — .ilike() es parametrizado y seguro
        if (!resolvedEmail) {
          const { data: byEmailPrefix } = await supabase
            .from('profiles')
            .select('email')
            .ilike('email', `${cleanInput}@%`)
            .maybeSingle()

          resolvedEmail = (byEmailPrefix as { email: string } | null)?.email ?? null
        }

        if (resolvedEmail) {
          targetEmail = resolvedEmail
        }
        // Si no se resuelve el email, se intenta el login con el input original.
        // Supabase Auth devolverá error → el mensaje genérico lo cubre sin revelar nada.
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      })

      if (authError) {
        // Mostrar mensaje detallado de Supabase para facilitar diagnóstico
        if (authError.message?.toLowerCase().includes('invalid login credentials')) {
          setError('Contraseña o usuario/email incorrecto. Verifica que la contraseña sea la exacta.')
        } else if (authError.message?.toLowerCase().includes('email not confirmed')) {
          setError('El correo aún no está confirmado en Supabase.')
        } else {
          setError(`Error de autenticación: ${authError.message}`)
        }
        setLoading(false)
        return
      }

      // ✅ Sesión iniciada — el middleware detectará la sesión en el siguiente request
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || GENERIC_ERROR)
      setLoading(false)
    }
  }

  return (
    <form
      id="login-form"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
    >
      {/* Usuario o Email */}
      <div className="space-y-1.5">
        <label
          htmlFor="login-identifier"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Usuario o Email
        </label>
        <input
          id="login-identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="peufeliz  o  tu@email.com"
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
          htmlFor="login-password"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Contraseña
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
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
        id="btn-login-submit"
        type="submit"
        disabled={loading || !identifier || !password}
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
            <span>Iniciando sesión…</span>
          </>
        ) : (
          'Iniciar sesión'
        )}
      </button>

      {/* Admin notice */}
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-700 pt-1">
        <ShieldCheck size={12} />
        Acceso restringido · Solo admin
      </p>
    </form>
  )
}
