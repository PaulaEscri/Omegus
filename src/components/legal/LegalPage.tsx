import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'

// Estructura común de las páginas públicas /privacy y /terms (sin sesión, sin BottomNav).
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-300">
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(139,92,246,0.12) 0%, transparent 70%)',
        }}
      />
      <main
        className="relative px-5 pt-8 max-w-xl mx-auto"
        style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <header className="mb-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
          >
            <ArrowLeft size={16} /> Volver
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-11 h-11 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
              <Wallet size={22} className="text-white" strokeWidth={1.75} />
            </span>
            <span className="text-sm font-semibold text-zinc-500">Omegus · Finanzas Personales</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">{title}</h1>
          <p className="text-xs text-zinc-600 mt-2">Última actualización: {updated}</p>
        </header>

        <div className="space-y-7 text-[15px] leading-relaxed">{children}</div>

        <footer className="mt-12 pt-6 border-t border-zinc-800/60 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">
          <Link href="/privacy" className="hover:text-zinc-400">Privacidad</Link>
          <Link href="/terms" className="hover:text-zinc-400">Términos de uso</Link>
          <a href="mailto:attarastudio@gmail.com" className="hover:text-zinc-400">attarastudio@gmail.com</a>
        </footer>
      </main>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-base font-bold text-zinc-100">{title}</h2>
      {children}
    </section>
  )
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" aria-hidden="true" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}
