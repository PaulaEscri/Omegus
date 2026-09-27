'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyChartPoint } from '@/lib/queries/dashboard'

interface CashbackChartProps {
  data: MonthlyChartPoint[]
  totalCashback: number
}

function CashbackTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-amber-500/30 bg-zinc-900/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl text-sm">
      <p className="text-zinc-500 text-[11px] mb-1 capitalize">{label}</p>
      <p className="font-bold text-amber-400">
        {payload[0].value.toLocaleString('es-ES', {
          style: 'currency',
          currency: 'EUR',
        })}
      </p>
    </div>
  )
}

export function CashbackChart({ data, totalCashback }: CashbackChartProps) {
  const hasData = data.some((d) => d.cashback > 0)

  return (
    <div>
      {/* Total acumulado */}
      <div className="flex items-baseline gap-1.5 mb-4">
        <span className="text-2xl font-bold text-amber-400">
          {totalCashback.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
          })}
        </span>
        <span className="text-xs text-zinc-600">acumulado (6 meses)</span>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 0, left: -24, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cashback-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: '#52525b', fontSize: 10, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              tick={{ fill: '#52525b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}€`}
            />
            <Tooltip content={<CashbackTooltip />} />
            <Area
              type="monotone"
              dataKey="cashback"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#cashback-gradient)"
              dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[80px]">
          <p className="text-xs text-amber-900/70 text-center">
            Registra ingresos de categoría{' '}
            <span className="text-amber-600/80 font-medium">Cashback / Intereses</span>{' '}
            para ver la evolución
          </p>
        </div>
      )}
    </div>
  )
}
