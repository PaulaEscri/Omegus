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

// ── Balances de cuentas (calculados desde el histórico real) ─
// No se usa la vista v_account_balance: se recalcula aquí para garantizar
// que un movimiento "savings" (ahorro/inversión) se trate como una
// transferencia interna de patrimonio — sale de la cuenta origen y entra
// en la cuenta destino — y nunca como un gasto perdido.
export async function getAccountBalances(
  supabase: SupabaseClient
): Promise<AccountBalanceData[]> {
  const { data: accountsData, error: accountsError } = await supabase
    .from('accounts')
    .select('id, name, type, color')
    .eq('is_active', true)
    .order('sort_order')

  if (accountsError) {
    console.warn('No se pudieron cargar las cuentas:', accountsError.message)
    return []
  }

  const accounts = (accountsData ?? []) as { id: string; name: string; type: string; color: string }[]
  if (accounts.length === 0) return []

  const { data: txsData, error: txsError } = await supabase
    .from('transactions')
    .select('type, amount, account_id, destination_account_id')

  if (txsError) {
    console.warn('No se pudieron cargar los movimientos, saldos a 0:', txsError.message)
  }

  const txs = (txsData ?? []) as {
    type: string
    amount: number
    account_id: string | null
    destination_account_id: string | null
  }[]

  const balances = new Map<string, number>(accounts.map((a) => [a.id, 0]))

  for (const tx of txs) {
    const amount = Number(tx.amount)

    if (tx.type === 'income') {
      if (tx.account_id && balances.has(tx.account_id)) {
        balances.set(tx.account_id, balances.get(tx.account_id)! + amount)
      }
    } else if (tx.type === 'expense') {
      if (tx.account_id && balances.has(tx.account_id)) {
        balances.set(tx.account_id, balances.get(tx.account_id)! - amount)
      }
    } else if (tx.type === 'savings') {
      // Transferencia interna: resta en origen, suma en destino
      if (tx.account_id && balances.has(tx.account_id)) {
        balances.set(tx.account_id, balances.get(tx.account_id)! - amount)
      }
      if (tx.destination_account_id && balances.has(tx.destination_account_id)) {
        balances.set(
          tx.destination_account_id,
          balances.get(tx.destination_account_id)! + amount
        )
      }
    }
  }

  return accounts.map((a) => ({
    account_id: a.id,
    name: a.name,
    type: a.type,
    color: a.color,
    balance: Math.round((balances.get(a.id) ?? 0) * 100) / 100,
  }))
}
