import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ── Activos únicos del usuario (para el Combobox) ─────────────
export async function getPastSavingsConcepts(): Promise<string[]> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('transactions')
    .select('concept')
    .eq('type', 'savings')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching past concepts:', error.message)
    return []
  }

  // Deduplica manteniendo el orden (más reciente primero)
  const seen = new Set<string>()
  const result: string[] = []
  for (const row of data ?? []) {
    const c = (row.concept as string)?.trim()
    if (c && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase())
      result.push(c)
    }
  }
  return result
}

// ── Cartera: agrupar savings por concepto ────────────────────
export interface PortfolioAsset {
  concept: string
  totalInvested: number   // suma de amounts
  txCount: number         // número de transacciones
  lastDate: string        // fecha más reciente
  color: string           // color determinístico por concepto
}

// Paleta de colores para los activos (cicla si hay más de 12)
const ASSET_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16',
  '#a855f7', '#06b6d4', '#eab308', '#64748b', '#d946ef',
]

export async function getPortfolioData(supabase: SupabaseClient<Database>): Promise<{
  assets: PortfolioAsset[]
  totalInvested: number
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('transactions')
    .select('concept, amount, transaction_date')
    .eq('type', 'savings')
    .order('transaction_date', { ascending: false })

  if (error) throw error

  // Agrupar por concept
  const map = new Map<string, { total: number; count: number; lastDate: string }>()
  for (const row of data ?? []) {
    const key = (row.concept as string)?.trim() || 'Sin nombre'
    const existing = map.get(key)
    if (existing) {
      existing.total += Number(row.amount)
      existing.count += 1
      if (row.transaction_date > existing.lastDate) {
        existing.lastDate = row.transaction_date
      }
    } else {
      map.set(key, {
        total: Number(row.amount),
        count: 1,
        lastDate: row.transaction_date as string,
      })
    }
  }

  // Convertir a array + asignar color
  const assets: PortfolioAsset[] = Array.from(map.entries()).map(([concept, v], i) => ({
    concept,
    totalInvested: Math.round(v.total * 100) / 100,
    txCount: v.count,
    lastDate: v.lastDate,
    color: ASSET_COLORS[i % ASSET_COLORS.length],
  }))

  // Ordenar de mayor a menor
  assets.sort((a, b) => b.totalInvested - a.totalInvested)

  const totalInvested = assets.reduce((s, a) => s + a.totalInvested, 0)

  return { assets, totalInvested }
}
