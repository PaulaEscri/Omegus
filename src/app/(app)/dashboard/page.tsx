import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, PiggyBank, Sparkles,
  PlusCircle, Clock, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData, getAccountBalances } from '@/lib/queries/dashboard'
import { MonthlyChart } from '@/components/dashboard/MonthlyChart'
import { CashbackChart } from '@/components/dashboard/CashbackChart'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { formatCurrency } from '@/lib/utils'


export const metadata: Metadata = {
  title: 'Dashboard · Finanzas',
  description: 'Resumen de tus finanzas del mes actual.',
}

// Revalidar en cada visita (datos en tiempo real)
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const monthLabel = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  // Fetch data — silenciar errores si Supabase no está configurado aún
  let chartData = [] as Awaited<ReturnType<typeof getDashboardData>>['chartData']
  let summary = { income: 0, expenses: 0, savings: 0, cashback: 0, balance: 0 }
  let accounts = [] as Awaited<ReturnType<typeof getAccountBalances>>

  try {
    const result = await getDashboardData(supabase)
    chartData = result.chartData
    summary = result.summary
    accounts = await getAccountBalances(supabase)
  } catch (err) {
    console.error('Dashboard data error:', err)
  }

  const totalCashback = chartData.reduce((s, d) => s + d.cashback, 0)
  const liquidAccounts = accounts.filter((a) => a.type !== 'broker')
  const brokerAccounts = accounts.filter((a) => a.type === 'broker')
  const totalLiquid = liquidAccounts.reduce((s, a) => s + a.balance, 0)
  const totalBroker = brokerAccounts.reduce((s, a) => s + a.balance, 0)
  const totalWealth = totalLiquid + totalBroker

  const stats = [
    {
      label: 'Ingresos',
      value: summary.income,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      sign: '+',
    },
    {
      label: 'Gastos',
      value: summary.expenses,
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      sign: '−',
    },
    {
      label: 'Ahorro',
      value: summary.savings,
      icon: PiggyBank,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      sign: '→',
    },
  ]

  return (
    <div className="min-h-full bg-zinc-950">
      <div className="px-5 pt-8 pb-4 max-w-md mx-auto space-y-7">

        {/* ── HEADER ────────────────────────────────────────── */}
        <header className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-1.5">
              {monthLabel}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
              Mis Finanzas
            </h1>
          </div>
          <LogoutButton />
        </header>

        {/* ── BALANCE DEL MES ───────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1">
            Balance del mes
          </p>
          <p className={`text-3xl font-bold tracking-tight ${
            summary.balance >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {summary.balance >= 0 ? '+' : ''}{formatCurrency(summary.balance)}
          </p>
        </div>

        {/* ── STATS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map(({ label, value, icon: Icon, color, bg, sign }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-zinc-800/70 bg-zinc-900/50"
            >
              <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${bg}`}>
                <Icon size={18} className={color} strokeWidth={2} />
              </span>
              <div className="text-center px-1">
                <p className={`text-sm font-bold ${color} leading-tight`}>
                  {sign}{formatCurrency(value)}
                </p>
                <p className="text-[10px] font-medium text-zinc-600 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── CTAs ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/registro"
            id="btn-cta-registrar"
            className="group flex flex-col items-center justify-center gap-2.5 h-[106px] rounded-2xl bg-violet-600 hover:bg-violet-500 active:scale-[0.97] transition-all duration-200 shadow-lg shadow-violet-600/25"
          >
            <PlusCircle
              size={30}
              className="text-white/90 group-hover:scale-110 transition-transform duration-200"
              strokeWidth={1.75}
            />
            <span className="text-[15px] font-semibold text-white tracking-tight">
              Registrar actividad
            </span>
          </Link>

          <Link
            href="/historial"
            id="btn-cta-historial"
            className="group flex flex-col items-center justify-center gap-2.5 h-[106px] rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-[0.97] transition-all duration-200"
          >
            <Clock
              size={30}
              className="text-zinc-400 group-hover:text-zinc-200 transition-colors duration-200"
              strokeWidth={1.75}
            />
            <span className="text-[15px] font-semibold text-zinc-300 tracking-tight">
              Ver registros
            </span>
          </Link>
        </div>

        {/* ── GRÁFICO: INGRESOS VS GASTOS ───────────────────── */}
        <section aria-labelledby="chart-monthly">
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 id="chart-monthly" className="text-sm font-semibold text-zinc-200">
                Ingresos vs Gastos
              </h2>
              <span className="text-[11px] text-zinc-600 bg-zinc-800 px-2 py-1 rounded-lg">
                6 meses
              </span>
            </div>
            <MonthlyChart data={chartData} />
          </div>
        </section>

        {/* ── GRÁFICO: CASHBACK Y RENDIMIENTOS ──────────────── */}
        <section aria-labelledby="chart-cashback">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-amber-400" strokeWidth={2} />
              </div>
              <h2 id="chart-cashback" className="text-sm font-semibold text-zinc-200">
                Cashback y Rendimientos
              </h2>
            </div>
            <CashbackChart data={chartData} totalCashback={totalCashback} />
          </div>
        </section>

        {/* ── PATRIMONIO ────────────────────────────────────── */}
        <section aria-labelledby="wealth-section">
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 id="wealth-section" className="text-sm font-semibold text-zinc-200">
                Patrimonio
              </h2>
              <span className="text-sm font-bold text-zinc-100">
                {formatCurrency(totalWealth)}
              </span>
            </div>

            {accounts.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">
                Sin cuentas configuradas aún
              </p>
            ) : (
              <div className="space-y-3">
                {/* Liquid */}
                {totalWealth > 0 && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-zinc-500">
                          Efectivo / Banco
                        </span>
                        <span className="text-xs font-semibold text-emerald-400">
                          {formatCurrency(totalLiquid)}
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/70 transition-all duration-700"
                          style={{ width: `${totalWealth > 0 ? (totalLiquid / totalWealth) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-zinc-500">
                          Bonos / Inversión
                        </span>
                        <span className="text-xs font-semibold text-blue-400">
                          {formatCurrency(totalBroker)}
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500/70 transition-all duration-700"
                          style={{ width: `${totalWealth > 0 ? (totalBroker / totalWealth) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Detalle de cuentas */}
                <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                  {accounts.map((acc) => (
                    <div key={acc.account_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: acc.color }}
                        />
                        <span className="text-xs text-zinc-500">{acc.name}</span>
                      </div>
                      <span className={`text-xs font-semibold ${
                        acc.balance >= 0 ? 'text-zinc-300' : 'text-red-400'
                      }`}>
                        {formatCurrency(acc.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
