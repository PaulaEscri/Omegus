import type { SupabaseClient } from '@supabase/supabase-js'
import { format, subMonths, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export interface MonthlyChartPoint {
  month: string      // Etiqueta: 'mar', 'abr', …
  monthKey: string   // 'YYYY-MM' para ordenación
  income: number
  expenses: number
  savings: number
  cashback: number
}

export interface CurrentMonthSummary {
  income: number
  expenses: number
  savings: number
  cashback: number
  balance: number   // income - expenses
}

export interface AccountBalanceData {
  account_id: string
  name: string
  type: string
  balance: number
  color: string
}

// ── Resumen mensual + datos para gráfico (últimos N meses) ──
export async function getDashboardData(
  supabase: SupabaseClient,
  monthsBack = 6
): Promise<{ chartData: MonthlyChartPoint[]; summary: CurrentMonthSummary }> {
  const startDate = format(
    startOfMonth(subMonths(new Date(), monthsBack - 1)),
    'yyyy-MM-dd'
  )

  // Fetch transacciones + is_cashback de la categoría
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'type, amount, transaction_date, category:categories!category_id(is_cashback)'
    )
    .gte('transaction_date', startDate)

  if (error) throw error

  // Inicializar todos los meses en 0
  const monthsMap: Record<string, MonthlyChartPoint> = {}
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i)
    const key = format(d, 'yyyy-MM')
    monthsMap[key] = {
      month: format(d, 'MMM', { locale: es }),
      monthKey: key,
      income: 0,
      expenses: 0,
      savings: 0,
      cashback: 0,
    }
  }

  // Acumular valores
  for (const tx of data ?? []) {
    const key = (tx.transaction_date as string).substring(0, 7)
    if (!monthsMap[key]) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isCashback = (tx.category as any)?.is_cashback === true
    const amount = Number(tx.amount)

    if (tx.type === 'income') {
      if (isCashback) monthsMap[key].cashback += amount
      else monthsMap[key].income += amount
    } else if (tx.type === 'expense') {
      monthsMap[key].expenses += amount
    } else if (tx.type === 'savings') {
      monthsMap[key].savings += amount
    }
  }

  const chartData = Object.values(monthsMap)
  const current = chartData[chartData.length - 1]

  return {
    chartData,
    summary: {
      income: current.income,
      expenses: current.expenses,
      savings: current.savings,
      cashback: current.cashback,
      balance: current.income - current.expenses,
    },
  }
}

// ── Balances de cuentas (desde la vista) ─────────────────────
export async function getAccountBalances(
  supabase: SupabaseClient
): Promise<AccountBalanceData[]> {
  const { data, error } = await supabase
    .from('v_account_balance')
    .select('account_id, name, type, balance, color')

  if (error) {
    // Si la vista no existe aún, devolver array vacío sin romper
    console.warn('v_account_balance not ready:', error.message)
    return []
  }

  return (data ?? []) as AccountBalanceData[]
}
