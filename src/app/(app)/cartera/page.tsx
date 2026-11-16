import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { TrendingUp, ArrowUpRight, Clock, Layers } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getPortfolioData, type PortfolioAsset } from '@/lib/queries/portfolio'
import { fetchPortfolioPrices, applyMarketPrices } from '@/lib/queries/portfolioMarket'
import {
  MarketValueCard,
  MarketValueCardSkeleton,
  MarketFootnote,
  AssetAmounts,
  AssetAmountsLive,
} from './MarketBlocks'
import { PortfolioDonut } from '@/components/dashboard/PortfolioDonut'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getSessionUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Cartera · Finanzas',
  description: 'Resumen de tus inversiones y ahorros agrupados por activo.',
}

export const dynamic = 'force-dynamic'

export default async function CarteraPage() {
  const supabase = await createClient()
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Parte rápida: solo BD. Se pinta al instante.
  let assets: PortfolioAsset[] = []
  let totalInvested = 0

  try {
    const result = await getPortfolioData(supabase)
    assets = result.assets
    totalInvested = result.totalInvested
  } catch (err) {
    console.error('Portfolio data error:', err)
  }

  // Parte lenta: precios de mercado. NO se espera aquí: la promesa se pasa a
  // los bloques que la necesitan, cada uno dentro de su <Suspense>.
  const marketPromise = fetchPortfolioPrices(assets).then((prices) =>
    applyMarketPrices(assets, totalInvested, prices)
  )

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

        {/* ── INVERTIDO vs VALOR REAL (hero cards) ─────────── */}
        <section aria-labelledby="total-invested-label" className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-violet-600/20 via-blue-600/10 to-zinc-900/50 border border-violet-500/20 p-5">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <TrendingUp size={14} className="text-violet-400" />
              </div>
              <p id="total-invested-label" className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Invertido
              </p>
            </div>
            <p className="text-2xl font-bold text-violet-300 tracking-tight">
              {formatCurrency(totalInvested)}
            </p>
            {assets.length > 0 && (
              <p className="text-[11px] text-zinc-500 mt-1.5">
                {assets.length} {assets.length === 1 ? 'activo' : 'activos'}
              </p>
            )}
          </div>

          <Suspense fallback={<MarketValueCardSkeleton />}>
            <MarketValueCard marketPromise={marketPromise} />
          </Suspense>
        </section>

        <Suspense fallback={null}>
          <MarketFootnote marketPromise={marketPromise} />
        </Suspense>

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
                          {asset.ticker && (
                            <span className="text-[9px] font-bold text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded">
                              {asset.ticker}
                            </span>
                          )}
                        </div>
                        <Suspense fallback={<AssetAmounts asset={asset} marketValue={null} />}>
                          <AssetAmountsLive marketPromise={marketPromise} asset={asset} />
                        </Suspense>
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
