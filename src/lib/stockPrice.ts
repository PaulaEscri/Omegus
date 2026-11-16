// ============================================================
// Precios de mercado — SOLO SERVIDOR
// ============================================================
// Usa Finnhub (https://finnhub.io) para consultar la cotización actual de
// un ticker. Requiere la variable de entorno FINNHUB_API_KEY (NUNCA
// NEXT_PUBLIC_, para que la key no llegue al cliente). Sin la key
// configurada, devuelve null y Cartera muestra el invertido como
// estimación del valor de mercado.
//
// Importar este módulo solo desde código de servidor (route handlers,
// server actions, server components) — nunca desde un componente 'use client'.

const FINNHUB_QUOTE_URL = 'https://finnhub.io/api/v1/quote'

// Caché en memoria del proceso (best-effort; se complementa con el caché
// de fetch de Next.js). Evita pedir el mismo ticker varias veces en la
// misma request/render.
const memoryCache = new Map<string, { price: number; ts: number }>()
const MEMORY_TTL_MS = 5 * 60 * 1000 // 5 minutos

export async function getStockPrice(ticker: string): Promise<number | null> {
  const apiKey = process.env.FINNHUB_API_KEY
  const symbol = ticker?.trim().toUpperCase()
  if (!apiKey || !symbol) return null

  const cached = memoryCache.get(symbol)
  if (cached && Date.now() - cached.ts < MEMORY_TTL_MS) {
    return cached.price
  }

  try {
    const url = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) {
      console.error(`Finnhub error for ${symbol}: HTTP ${res.status}`)
      return null
    }
    const data = (await res.json()) as { c?: number }
    const price = data.c
    if (!price || price <= 0) return null

    memoryCache.set(symbol, { price, ts: Date.now() })
    return price
  } catch (err) {
    console.error(`Error fetching price for ${symbol}:`, err)
    return null
  }
}

// ── Varios tickers en paralelo ───────────────────────────────
export async function getStockPrices(tickers: string[]): Promise<Record<string, number | null>> {
  const unique = Array.from(
    new Set(tickers.map((t) => t?.trim().toUpperCase()).filter((t): t is string => !!t))
  )
  const results = await Promise.all(unique.map(async (t) => [t, await getStockPrice(t)] as const))
  return Object.fromEntries(results)
}
