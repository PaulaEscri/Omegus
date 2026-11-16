// SOLO SERVIDOR: combina getPortfolioData con precios de mercado reales.
// No importar desde componentes 'use client'.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPortfolioData, type PortfolioAsset } from './portfolio'
import { getStockPrices } from '@/lib/stockPrice'

export interface PortfolioAssetWithMarket extends PortfolioAsset {
  currentPrice: number | null   // precio actual por unidad (null si no se pudo consultar)
  marketValue: number | null    // currentPrice * quantity (null si falta ticker/cantidad/precio)
}

export interface PortfolioWithMarket {
  assets: PortfolioAssetWithMarket[]
  totalInvested: number
  totalMarketValue: number       // usa marketValue si existe, o totalInvested como estimación
  allHaveMarketData: boolean     // false si algún activo no tiene precio real disponible
}

export type PriceMap = Record<string, number | null>

// Lanza la consulta de precios SIN bloquear: devuelve una promesa que nunca
// rechaza (si falla, mapa vacío → se usa el invertido como estimación). Permite
// pintar la página con los datos de la BD y completar los precios por streaming.
export function fetchPortfolioPrices(assets: PortfolioAsset[]): Promise<PriceMap> {
  const tickers = assets.map((a) => a.ticker).filter((t): t is string => !!t)
  if (tickers.length === 0) return Promise.resolve({})
  return getStockPrices(tickers).catch((err) => {
    console.error('Error fetching portfolio prices:', err)
    return {} as PriceMap
  })
}

export function applyMarketPrices(
  assets: PortfolioAsset[],
  totalInvested: number,
  prices: PriceMap
): PortfolioWithMarket {
  let allHaveMarketData = assets.length > 0

  const assetsWithMarket: PortfolioAssetWithMarket[] = assets.map((asset) => {
    const currentPrice = asset.ticker ? prices[asset.ticker.toUpperCase()] ?? null : null
    const marketValue =
      currentPrice != null && asset.quantity > 0
        ? Math.round(currentPrice * asset.quantity * 100) / 100
        : null

    if (marketValue == null) allHaveMarketData = false

    return { ...asset, currentPrice, marketValue }
  })

  const totalMarketValue = assetsWithMarket.reduce(
    (sum, a) => sum + (a.marketValue ?? a.totalInvested),
    0
  )

  return {
    assets: assetsWithMarket,
    totalInvested,
    totalMarketValue: Math.round(totalMarketValue * 100) / 100,
    allHaveMarketData,
  }
}

// Versión bloqueante (espera a los precios). La página de Cartera usa en su
// lugar fetchPortfolioPrices + applyMarketPrices para hacer streaming.
export async function getPortfolioWithMarketValues(
  supabase: SupabaseClient<Database>
): Promise<PortfolioWithMarket> {
  const { assets, totalInvested } = await getPortfolioData(supabase)
  const prices = await fetchPortfolioPrices(assets)
  return applyMarketPrices(assets, totalInvested, prices)
}
