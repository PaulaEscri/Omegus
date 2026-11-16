// Bloques de Cartera que dependen de los precios de mercado (Finnhub).
// Son componentes de SERVIDOR asíncronos: cada uno espera a `marketPromise`
// dentro de su propio <Suspense>, así la página se pinta al instante con los
// datos de la BD y los valores reales entran por streaming.
import { LineChart } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { PortfolioAsset } from '@/lib/queries/portfolio'
import type { PortfolioWithMarket } from '@/lib/queries/portfolioMarket'
import { Skeleton } from '@/components/ui/skeleton'

type MarketPromise = Promise<PortfolioWithMarket>

// ── Tarjeta "Valor real" ─────────────────────────────────────
function ValueCardFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-600/15 via-zinc-900/50 to-zinc-900/50 border border-emerald-500/20 p-5">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <LineChart size={14} className="text-emerald-400" />
        </div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
      </div>
      {children}
    </div>
  )
}

export function MarketValueCardSkeleton() {
  return (
    <ValueCardFrame label="Valor real">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-20 mt-2" />
    </ValueCardFrame>
  )
}

export async function MarketValueCard({ marketPromise }: { marketPromise: MarketPromise }) {
  const { totalMarketValue, totalInvested, allHaveMarketData } = await marketPromise
  const diff = totalMarketValue - totalInvested
  const diffPct = totalInvested > 0 ? (diff / totalInvested) * 100 : 0

  return (
    <ValueCardFrame label={`Valor real${!allHaveMarketData ? ' *' : ''}`}>
      <p className="text-2xl font-bold text-emerald-300 tracking-tight">
        {formatCurrency(totalMarketValue)}
      </p>
      {totalInvested > 0 && (
        <p className={cn('text-[11px] font-semibold mt-1.5', diff >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {diff >= 0 ? '+' : ''}{formatCurrency(diff)} ({diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%)
        </p>
      )}
    </ValueCardFrame>
  )
}

// ── Nota al pie (activos sin precio) ─────────────────────────
export async function MarketFootnote({ marketPromise }: { marketPromise: MarketPromise }) {
  const { allHaveMarketData, assets } = await marketPromise
  if (allHaveMarketData || assets.length === 0) return null
  return (
    <p className="text-[11px] text-zinc-600 px-1 -mt-2">
      * Algún activo no tiene ticker o no se pudo consultar su precio — se usa el invertido como estimación.
    </p>
  )
}

// ── Columna derecha de cada activo (valor + variación) ───────
export function AssetAmounts({
  asset,
  marketValue,
}: {
  asset: PortfolioAsset
  marketValue: number | null
}) {
  const up = marketValue != null && marketValue >= asset.totalInvested
  return (
    <div className="text-right">
      <p className="text-sm font-bold text-zinc-100">
        {formatCurrency(marketValue ?? asset.totalInvested)}
      </p>
      <p className="text-[10px] text-zinc-500">Invertido: {formatCurrency(asset.totalInvested)}</p>
      {marketValue != null && asset.totalInvested > 0 && (
        <p className={cn('text-[10px] font-semibold', up ? 'text-emerald-400' : 'text-red-400')}>
          {up ? '+' : ''}
          {(((marketValue - asset.totalInvested) / asset.totalInvested) * 100).toFixed(1)}%
        </p>
      )}
    </div>
  )
}

export async function AssetAmountsLive({
  marketPromise,
  asset,
}: {
  marketPromise: MarketPromise
  asset: PortfolioAsset
}) {
  const { assets } = await marketPromise
  const live = assets.find((a) => a.concept === asset.concept)
  return <AssetAmounts asset={asset} marketValue={live?.marketValue ?? null} />
}
