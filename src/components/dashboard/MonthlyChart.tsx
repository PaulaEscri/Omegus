'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { MonthlyChartPoint } from '@/lib/queries/dashboard'

interface MonthlyChartProps {
  data: MonthlyChartPoint[]
}

// Tooltip personalizado en dark mode
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/95 backdrop-blur-sm px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-zinc-300 mb-2 capitalize">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span style={{ color: p.color }} className="font-medium">
            {p.name}
          </span>
          <span className="font-bold text-zinc-100">
            {p.value.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const hasData = data.some((d) => d.income > 0 || d.expenses > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[180px]">
        <p className="text-sm text-zinc-600">
          Sin datos todavía — registra tu primera transacción
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 0, left: -20, bottom: 0 }}
        barCategoryGap="30%"
        barGap={3}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: '#52525b', fontSize: 11, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          tick={{ fill: '#52525b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
          }
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 6 }}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
          formatter={(value) => (
            <span style={{ color: '#a1a1aa', fontWeight: 500 }}>
              {value}
            </span>
          )}
        />
        <Bar
          dataKey="income"
          name="Ingresos"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="expenses"
          name="Gastos"
          fill="#ef4444"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
