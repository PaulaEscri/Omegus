'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, PlusCircle, Clock, Settings2, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, primary: false },
  { href: '/cartera', label: 'Cartera', icon: PieChart, primary: false },
  { href: '/registro', label: 'Registrar', icon: PlusCircle, primary: true },
  { href: '/historial', label: 'Historial', icon: Clock, primary: false },
  { href: '/ajustes', label: 'Ajustes', icon: Settings2, primary: false },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-around h-[4.5rem] px-4 max-w-md mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                id={`nav-${label.toLowerCase()}`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center gap-1 -mt-5"
              >
                <span
                  className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center',
                    'shadow-lg shadow-violet-600/30 transition-all duration-200',
                    isActive
                      ? 'bg-violet-500 scale-95'
                      : 'bg-violet-600 active:scale-95 hover:bg-violet-500'
                  )}
                >
                  <Icon size={26} strokeWidth={2} className="text-white" />
                </span>
                <span className={cn('text-[10px] font-medium', isActive ? 'text-violet-400' : 'text-zinc-500')}>
                  {label}
                </span>
              </Link>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              id={`nav-${label.toLowerCase()}`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center gap-1 flex-1 py-2 group"
            >
              <span
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
                  isActive ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-500 group-active:scale-95'
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className={cn('text-[10px] font-medium transition-colors', isActive ? 'text-violet-400' : 'text-zinc-500')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
