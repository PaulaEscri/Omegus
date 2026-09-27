import type { Metadata, Viewport } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'
import { Wallet } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Acceder · Finanzas',
  description: 'Accede a tu panel de finanzas personales.',
  robots: 'noindex, nofollow',
}

export const viewport: Viewport = {
  themeColor: '#09090b',
}

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-950 px-6">
      {/* Gradiente de fondo sutil */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-violet-600 flex items-center justify-center mb-5 shadow-2xl shadow-violet-600/30">
            <Wallet size={36} className="text-white" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            Finanzas Personales
          </h1>
          <p className="text-sm text-zinc-500 mt-1.5">Tu control financiero</p>
        </div>

        {/* Card de login */}
        <div className="animate-scale-in rounded-3xl border border-zinc-800/70 bg-zinc-900/60 backdrop-blur-xl p-7">
          <h2 className="text-lg font-bold text-zinc-100 mb-1">
            Bienvenido
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            Inicia sesión para continuar
          </p>

          <LoginForm />
        </div>
      </div>
    </div>
  )
}
