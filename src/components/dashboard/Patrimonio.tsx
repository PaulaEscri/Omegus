'use client'

import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { cn, formatCurrency } from '@/lib/utils'
import type { AccountBalanceData } from '@/lib/queries/dashboard'

interface PatrimonioProps {
  accounts: AccountBalanceData[]
}

interface GroupedAccount {
  name: string
  balance: number
  color: string
  type: string
}

type DisplayMode = 'eur' | 'pct'

function CustomTooltip({
  active,
  payload,
  mode,
  total,
}: {
  active?: boolean
  payload?: { payload: GroupedAccount }[]
  mode?: DisplayMode
  total?: number
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  const pct = total && total > 0 ? (item.balance / total) * 100 : 0
  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/95 shadow-xl px-3 py-2.5 text-xs">
      <p className="font-semibold text-zinc-100 mb-1">{item.name}</p>
      <p className="text-zinc-300">
        {mode === 'pct' ? `${pct.toFixed(1)}%` : formatCurrency(item.balance)}
      </p>
    </div>
  )
}

export function Patrimonio({ accounts }: PatrimonioProps) {
  const [mode, setMode] = useState<DisplayMode>('eur')

  // Agrupa cuentas con el mismo nombre (p. ej. varias cuentas "Efectivo") sumando sus saldos
  const grouped = useMemo<GroupedAccount[]>(() => {
    return accounts.reduce<GroupedAccount[]>((acc, curr) => {
      const existing = acc.find(
        (a) => a.name.trim().toLowerCase() === curr.name.trim().toLowerCase()
      )
      if (existing) {
        existing.balance += curr.balance
      } else {
        acc.push({ name: curr.name, balance: curr.balance, color: curr.color, type: curr.type })
      }
      return acc
    }, [])
  }, [accounts])

  const total = grouped.reduce((s, a) => s + a.balance, 0)
  const chartData = grouped.filter((a) => a.balance > 0)

  if (accounts.length === 0) {
    return (
      <p className="text-xs text-zinc-600 text-center py-4">
        Sin cuentas configuradas aún
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toggle % / € */}
      <div className="flex justify-end">
        <div className="flex p-0.5 bg-zinc-800/70 rounded-lg">
          <button
            type="button"
            onClick={() => setMode('eur')}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-bold transition-all',
              mode === 'eur' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            €
          </button>
          <button
            type="button"
            onClick={() => setMode('pct')}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-bold transition-all',
              mode === 'pct' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            %
          </button>
        </div>
      </div>

      {/* Total (patrimonio neto real, siempre visible sea cual sea el signo) */}
      <div className="text-center">
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
          Patrimonio neto
        </p>
        <p
          className={cn(
            'text-2xl font-bold tracking-tight',
            total >= 0 ? 'text-violet-300' : 'text-red-400'
          )}
        >
          {formatCurrency(total)}
        </p>
      </div>

      {/* Donut chart (solo se pinta si hay saldos positivos que repartir) */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={82}
              paddingAngle={2}
              dataKey="balance"
              nameKey="name"
              stroke="none"
              label={false}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip mode={mode} total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-xs text-zinc-600 text-center py-6">
          Sin saldo positivo para graficar
        </p>
      )}

      {/* Detalle por cuenta (agrupado) */}
      <div className="pt-2 border-t border-zinc-800/60 space-y-2">
        {grouped.map((acc) => {
          const pct = total > 0 ? (acc.balance / total) * 100 : 0
          return (
            <div key={acc.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: acc.color }}
                />
                <span className="text-xs text-zinc-500">{acc.name}</span>
              </div>
              <span
                className={cn(
                  'text-xs font-semibold',
                  acc.balance >= 0 ? 'text-zinc-300' : 'text-red-400'
                )}
              >
                {mode === 'pct' ? `${pct.toFixed(1)}%` : formatCurrency(acc.balance)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
