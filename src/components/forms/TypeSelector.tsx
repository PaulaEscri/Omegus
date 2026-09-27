'use client'

import { cn } from '@/lib/utils'
import type { TransactionType } from '@/types/database'
import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'

interface TypeSelectorProps {
  value: TransactionType
  onChange: (value: TransactionType) => void
}

const TYPES: {
  value: TransactionType
  label: string
  icon: React.ElementType
  activeClass: string
  inactiveClass: string
  dotClass: string
}[] = [
  {
    value: 'income',
    label: 'Ingreso',
    icon: TrendingUp,
    activeClass: 'bg-emerald-500/15 border-emerald-500 text-emerald-400',
    inactiveClass: 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'expense',
    label: 'Gasto',
    icon: TrendingDown,
    activeClass: 'bg-red-500/15 border-red-500 text-red-400',
    inactiveClass: 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
    dotClass: 'bg-red-500',
  },
  {
    value: 'savings',
    label: 'Ahorro',
    icon: PiggyBank,
    activeClass: 'bg-blue-500/15 border-blue-500 text-blue-400',
    inactiveClass: 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
    dotClass: 'bg-blue-500',
  },
]

export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div role="group" aria-label="Tipo de transacción" className="grid grid-cols-3 gap-2">
      {TYPES.map(({ value: type, label, icon: Icon, activeClass, inactiveClass, dotClass }) => {
        const isActive = value === type
        return (
          <button
            key={type}
            type="button"
            id={`type-${type}`}
            aria-pressed={isActive}
            onClick={() => onChange(type)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1.5',
              'h-[72px] rounded-xl border-2 transition-all duration-200',
              'active:scale-95 select-none',
              isActive ? activeClass : inactiveClass
            )}
          >
            {/* Indicador activo */}
            {isActive && (
              <span
                className={cn(
                  'absolute top-2 right-2 w-1.5 h-1.5 rounded-full',
                  dotClass
                )}
              />
            )}
            <Icon
              size={22}
              strokeWidth={isActive ? 2.5 : 2}
              className="transition-all duration-200"
            />
            <span className="text-xs font-semibold tracking-wide">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
