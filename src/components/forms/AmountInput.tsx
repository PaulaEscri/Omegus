'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Euro } from 'lucide-react'
import type { TransactionType } from '@/types/database'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  transactionType: TransactionType
  error?: string
  currency?: string
}

const TYPE_COLOR: Record<TransactionType, string> = {
  income: 'text-emerald-400',
  expense: 'text-red-400',
  savings: 'text-blue-400',
}

const TYPE_BORDER: Record<TransactionType, string> = {
  income: 'focus-within:border-emerald-500/60',
  expense: 'focus-within:border-red-500/60',
  savings: 'focus-within:border-blue-500/60',
}

const TYPE_BG: Record<TransactionType, string> = {
  income: 'focus-within:bg-emerald-500/5',
  expense: 'focus-within:bg-red-500/5',
  savings: 'focus-within:bg-blue-500/5',
}

export function AmountInput({
  value,
  onChange,
  transactionType,
  error,
  currency = 'EUR',
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitir números y un punto decimal
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    // Evitar múltiples puntos
    const parts = raw.split('.')
    if (parts.length > 2) return
    // Limitar decimales a 2
    if (parts[1] && parts[1].length > 2) return
    onChange(raw)
  }

  const displaySign = transactionType === 'income' ? '+' : transactionType === 'expense' ? '−' : '→'

  return (
    <div className="space-y-1.5">
      {/* Contenedor del input */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'w-full flex items-center gap-3 px-4 rounded-2xl border-2',
          'bg-zinc-900/60 border-zinc-800',
          'transition-all duration-200',
          TYPE_BORDER[transactionType],
          TYPE_BG[transactionType],
          error && 'border-red-500/60'
        )}
      >
        {/* Símbolo +/−/→ */}
        <span
          className={cn(
            'text-2xl font-bold w-6 text-center shrink-0',
            TYPE_COLOR[transactionType]
          )}
        >
          {displaySign}
        </span>

        {/* Input numérico */}
        <input
          ref={inputRef}
          id="amount-input"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={handleChange}
          className={cn(
            'flex-1 bg-transparent outline-none py-5',
            'text-4xl font-bold text-zinc-50 placeholder:text-zinc-700',
            'min-w-0'
          )}
          aria-label="Importe"
          aria-invalid={!!error}
          aria-describedby={error ? 'amount-error' : undefined}
        />

        {/* Divisa */}
        <span className="flex items-center gap-1 shrink-0 text-zinc-500">
          <Euro size={18} strokeWidth={1.5} />
          <span className="text-sm font-medium">{currency}</span>
        </span>
      </button>

      {/* Error */}
      {error && (
        <p id="amount-error" role="alert" className="text-xs text-red-400 px-1">
          {error}
        </p>
      )}
    </div>
  )
}
