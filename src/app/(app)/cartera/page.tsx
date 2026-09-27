import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TrendingUp, ArrowUpRight, Clock, Layers } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getPortfolioData } from '@/lib/queries/portfolio'
import { PortfolioDonut } from '@/components/dashboard/PortfolioDonut'
import { formatCurrency, formatDate } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Cartera · Finanzas',
  description: 'Resumen de tus inversiones y ahorros agrupados por activo.',
}

export const dynamic = 'force-dynamic'

export default async function CarteraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let assets: Awaited<ReturnType<typeof getPortfolioData>>['assets'] = []
  let totalInvested = 0

  try {
    const result = await getPortfolioData()
    assets = result.assets
    totalInvested = result.totalInvested
  } catch (err) {
    console.error('Portfolio data error:', err)
  }

  // Activo con más peso
  const topAsset = assets[0]
  const topPct = totalInvested > 0 && topAsset
    ? ((topAsset.totalInvested / totalInvested) * 100).toFixed(1)
    : '0'

  return (
    <div className="min-h-full bg-zinc-950">
      <div className="px-5 pt-8 pb-6 max-w-md mx-auto space-y-6">

        {/* ── HEADER ──────────────────────────────────────── */}
        <header>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-1.5">
            Cartera de inversión
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
            Cartera
          </h1>
        </header>

        {/* ── TOTAL INVERTIDO (hero card) ──────────────────── */}
        <section aria-labelledby="total-invested-label">
          <div className="rounded-2xl bg-gradient-to-br from-violet-600/20 via-blue-600/10 to-zinc-900/50 border border-violet-500/20 p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <TrendingUp size={16} className="text-violet-400" />
              </div>
              <p id="total-invested-label" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Total Invertido
              </p>
            </div>
            <p className="text-4xl font-bold text-violet-300 tracking-tight">
              {formatCurrency(totalInvested)}
            </p>
            {assets.length > 0 && (
              <p className="text-xs text-zinc-500 mt-2">
                Distribuido en {assets.length} {assets.length === 1 ? 'activo' : 'activos'}
              </p>
            )}
          </div>
        </section>

        {/* ── DONUT CHART ──────────────────────────────────── */}
        <section aria-labelledby="chart-portfolio">
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 id="chart-portfolio" className="text-sm font-semibold text-zinc-200">
                Distribución por activo
              </h2>
              {topAsset && (
                <span className="text-[11px] text-zinc-500 bg-zinc-800 px-2 py-1 rounded-lg">
                  Mayor: {topAsset.concept} ({topPct}%)
                </span>
              )}
            </div>
            <PortfolioDonut assets={assets} totalInvested={totalInvested} />
          </div>
        </section>

        {/* ── LEYENDA DE ACTIVOS ───────────────────────────── */}
        {assets.length > 0 && (
          <section aria-labelledby="assets-legend">
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center gap-2">
                <Layers size={14} className="text-zinc-500" />
                <h2 id="assets-legend" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Activos ({assets.length})
                </h2>
              </div>

              <ul className="divide-y divide-zinc-800/40">
                {assets.map((asset, idx) => {
                  const pct = totalInvested > 0 ? (asset.totalInvested / totalInvested) * 100 : 0
                  return (
                    <li key={asset.concept} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {/* Número de ranking */}
                          <span className="text-[10px] font-bold text-zinc-600 w-4 text-center">
                            {idx + 1}
                          </span>
                          {/* Dot de color */}
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: asset.color }}
                          />
                          <span className="text-sm font-semibold text-zinc-200">
                            {asset.concept}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-zinc-100">
                            {formatCurrency(asset.totalInvested)}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {pct.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Barra de porcentaje */}
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden ml-7">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: asset.color,
                          }}
                        />
                      </div>

                      {/* Meta-info */}
                      <div className="flex items-center gap-3 ml-7 mt-1.5">
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                          <Clock size={9} />
                          {asset.txCount} {asset.txCount === 1 ? 'aportación' : 'aportaciones'}
                        </span>
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                          <ArrowUpRight size={9} />
                          Última: {formatDate(asset.lastDate)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        )}

        {/* ── EMPTY STATE ──────────────────────────────────── */}
        {assets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl">
              📈
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-300">Sin inversiones aún</p>
              <p className="text-sm text-zinc-600 mt-1 max-w-[240px] mx-auto">
                Registra transacciones de tipo Ahorro/Inversión y aparecerán aquí automáticamente.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
