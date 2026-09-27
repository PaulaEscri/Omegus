'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { PortfolioAsset } from '@/lib/queries/portfolio'
import { formatCurrency } from '@/lib/utils'

interface PortfolioDonutProps {
  assets: PortfolioAsset[]
  totalInvested: number
}

// Tooltip personalizado dark
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload as PortfolioAsset
  const pct = ((item.totalInvested / payload[0].payload._total) * 100).toFixed(1)
  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/95 shadow-xl px-3 py-2.5 text-xs">
      <p className="font-semibold text-zinc-100 mb-1">{item.concept}</p>
      <p className="text-zinc-300">{formatCurrency(item.totalInvested)}</p>
      <p className="text-zinc-500">{pct}% del total</p>
    </div>
  )
}

// Label personalizado dentro del donut
function CenterLabel({ cx, cy, totalInvested }: { cx: number; cy: number; totalInvested: number }) {
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#e4e4e7" fontSize={13} fontWeight={600}>
        Total
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#a78bfa" fontSize={16} fontWeight={700}>
        {formatCurrency(totalInvested)}
      </text>
    </g>
  )
}

export function PortfolioDonut({ assets, totalInvested }: PortfolioDonutProps) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center text-2xl">
          📊
        </div>
        <p className="text-sm text-zinc-500 text-center">
          Aún no tienes ahorros/inversiones registradas
        </p>
      </div>
    )
  }

  // Añadir total para calcular porcentajes en el tooltip
  const dataWithTotal = assets.map((a) => ({ ...a, _total: totalInvested }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={dataWithTotal}
          cx="50%"
          cy="50%"
          innerRadius={68}
          outerRadius={100}
          paddingAngle={2}
          dataKey="totalInvested"
          stroke="none"
          label={false}
        >
          {dataWithTotal.map((entry, idx) => (
            <Cell key={`cell-${idx}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {/* Label central via foreignObject trick con texto */}
        <text x="50%" y="47%" textAnchor="middle" fill="#a1a1aa" fontSize={11} fontWeight={500}>
          Total
        </text>
        <text x="50%" y="55%" textAnchor="middle" fill="#c4b5fd" fontSize={15} fontWeight={700}>
          {formatCurrency(totalInvested)}
        </text>
      </PieChart>
    </ResponsiveContainer>
  )
}
