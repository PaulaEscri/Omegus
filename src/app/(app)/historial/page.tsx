'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, isToday, isYesterday, parseISO, startOfMonth, subMonths, addMonths, eachMonthOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  TrendingUp, TrendingDown, PiggyBank, Trash2,
  X, Loader2, InboxIcon, AlertTriangle, ChevronLeft, ChevronRight, CalendarDays,
} from 'lucide-react'
import { cn, formatCurrency, getMonthRange } from '@/lib/utils'
import { getTransactions, deleteTransaction } from '@/lib/queries/transactions'
import type { Transaction, TransactionType } from '@/types/database'

// ── Tipos y helpers locales ──────────────────────────────────
type TabType = 'all' | TransactionType

const TABS: { value: TabType; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'savings', label: 'Ahorro' },
]

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

const TYPE_ICON: Record<TransactionType, React.ElementType> = {
  income: TrendingUp,
  expense: TrendingDown,
  savings: PiggyBank,
}

const TYPE_COLOR: Record<TransactionType, string> = {
  income: 'text-emerald-400 bg-emerald-500/10',
  expense: 'text-red-400 bg-red-500/10',
  savings: 'text-blue-400 bg-blue-500/10',
}

const TYPE_AMOUNT_COLOR: Record<TransactionType, string> = {
  income: 'text-emerald-400',
  expense: 'text-red-400',
  savings: 'text-blue-400',
}

const AMOUNT_SIGN: Record<TransactionType, string> = {
  income: '+',
  expense: '−',
  savings: '→',
}

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Hoy'
  if (isYesterday(date)) return 'Ayer'
  return format(date, "EEEE, d 'de' MMMM", { locale: es })
}

function groupByDate(txs: Transaction[]): [string, Transaction[]][] {
  const map: Record<string, Transaction[]> = {}
  for (const tx of txs) {
    if (!map[tx.transaction_date]) map[tx.transaction_date] = []
    map[tx.transaction_date].push(tx)
  }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
}

// ── Componente principal ─────────────────────────────────────
export default function HistorialPage() {
  const currentMonthStart = startOfMonth(new Date())

  const [tab, setTab] = useState<TabType>('all')
  const [selectedMonth, setSelectedMonth] = useState<Date>(currentMonthStart)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  // Lista de meses desde enero 2026 hasta el mes actual
  const availableMonths = useMemo(() => {
    const start = new Date(2026, 0, 1) // enero 2026
    const end = currentMonthStart
    return eachMonthOfInterval({ start, end }).reverse() // más reciente primero
  }, [currentMonthStart])

  const isCurrentMonth = isSameMonth(selectedMonth, currentMonthStart)

  const goToPrevMonth = () => setSelectedMonth((d) => startOfMonth(subMonths(d, 1)))
  const goToNextMonth = () => {
    if (isCurrentMonth) return
    setSelectedMonth((d) => startOfMonth(addMonths(d, 1)))
  }
  const goToCurrentMonth = () => setSelectedMonth(currentMonthStart)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { from: dateFrom, to: dateTo } = getMonthRange(selectedMonth)
    try {
      const { data } = await getTransactions({
        type: tab === 'all' ? undefined : tab,
        dateFrom,
        dateTo,
        limit: 100,
      })
      setTransactions(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [tab, selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async () => {
    if (!selectedTx) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteTransaction(selectedTx.id)
      setTransactions((prev) => prev.filter((t) => t.id !== selectedTx.id))
      setSelectedTx(null)
    } catch {
      setDeleteError('No se pudo eliminar. Inténtalo de nuevo.')
    } finally {
      setDeleting(false)
    }
  }

  // Totales del período filtrado
  const totals = transactions.reduce(
    (acc, tx) => {
      if (tx.type === 'income') acc.income += tx.amount
      if (tx.type === 'expense') acc.expense += tx.amount
      return acc
    },
    { income: 0, expense: 0 }
  )

  const grouped = groupByDate(transactions)

  return (
    <>
      <div className="min-h-full bg-zinc-950">
        <div className="px-5 pt-8 max-w-md mx-auto">

          {/* Header */}
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Historial</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-emerald-400 font-semibold">
                +{formatCurrency(totals.income)}
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-red-400 font-semibold">
                −{formatCurrency(totals.expense)}
              </span>
              <span className="text-zinc-700">·</span>
              <span className={`text-xs font-semibold ${
                totals.income - totals.expense >= 0 ? 'text-zinc-400' : 'text-red-400'
              }`}>
                Balance {formatCurrency(totals.income - totals.expense)}
              </span>
            </div>
          </header>

          {/* Pestañas de tipo */}
          <div className="flex gap-1.5 p-1 bg-zinc-900 rounded-xl mb-3">
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                id={`tab-${value}`}
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                  tab === value
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-400'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Selector de mes (‹ mes actual ›) */}
          <div className="flex items-center justify-between gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-xl px-1.5 py-1.5">
            <button
              type="button"
              id="btn-prev-month"
              onClick={goToPrevMonth}
              aria-label="Mes anterior"
              className="p-2.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors active:scale-95"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              id="btn-pick-month"
              onClick={() => setShowMonthPicker(true)}
              title="Seleccionar mes"
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-zinc-200 hover:text-violet-300 transition-colors py-1.5 capitalize"
            >
              <CalendarDays size={14} className="text-zinc-500" />
              {format(selectedMonth, 'MMMM yyyy', { locale: es })}
            </button>

            <button
              type="button"
              id="btn-next-month"
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              aria-label="Mes siguiente"
              className={cn(
                'p-2.5 rounded-lg transition-colors active:scale-95',
                isCurrentMonth
                  ? 'text-zinc-700 cursor-not-allowed'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Lista de transacciones */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 size={28} className="animate-spin text-zinc-700" />
              <p className="text-sm text-zinc-600">Cargando registros…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-2xl border border-zinc-800/60 bg-zinc-900/30">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center">
                <InboxIcon size={26} className="text-zinc-600" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-zinc-400">Sin registros</p>
                <p className="text-sm text-zinc-600 mt-1">
                  No hay transacciones en este período
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 pb-6">
              {grouped.map(([date, txs]) => {
                const dayExpenses = txs
                  .filter((t) => t.type === 'expense')
                  .reduce((s, t) => s + t.amount, 0)

                return (
                  <section key={date} aria-label={formatDateHeader(date)}>
                    {/* Date header */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h2 className="text-xs font-semibold text-zinc-500 capitalize">
                        {formatDateHeader(date)}
                      </h2>
                      {dayExpenses > 0 && (
                        <span className="text-[11px] text-zinc-700">
                          −{formatCurrency(dayExpenses)}
                        </span>
                      )}
                    </div>

                    {/* Transaction items */}
                    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden divide-y divide-zinc-800/40">
                      {txs.map((tx) => {
                        const Icon = TYPE_ICON[tx.type]
                        const iconClass = TYPE_COLOR[tx.type]
                        const amountClass = TYPE_AMOUNT_COLOR[tx.type]
                        const sign = AMOUNT_SIGN[tx.type]

                        return (
                          <button
                            key={tx.id}
                            id={`tx-${tx.id}`}
                            aria-label={`${tx.concept}, ${sign}${formatCurrency(tx.amount)}`}
                            onClick={() => {
                              setSelectedTx(tx)
                              setDeleteError('')
                            }}
                            className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-zinc-800/40 active:bg-zinc-800/60 transition-colors"
                          >
                            {/* Icono */}
                            <span
                              className={cn(
                                'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                                iconClass
                              )}
                            >
                              <Icon size={18} strokeWidth={2} />
                            </span>

                            {/* Texto */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-zinc-200 truncate">
                                {tx.concept}
                              </p>
                              <p className="text-xs text-zinc-600 mt-0.5 truncate">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {(tx.category as any)?.name ?? '—'}
                              </p>
                            </div>

                            {/* Importe */}
                            <span className={cn('text-sm font-bold shrink-0', amountClass)}>
                              {sign}{formatCurrency(tx.amount)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {/* ── MONTH PICKER DRAWER ──────────────────────────── */}
      {showMonthPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowMonthPicker(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar mes"
            className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="max-w-md mx-auto rounded-t-3xl border-t border-x border-zinc-800 bg-zinc-950 px-5 pt-5 pb-4">
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto mb-5" />

              {/* Título */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-zinc-100">Seleccionar mes</h2>
                <button
                  onClick={() => setShowMonthPicker(false)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Lista de meses */}
              <div className="overflow-y-auto max-h-72 -mx-2 px-2 space-y-1 pb-2">
                {availableMonths.map((month) => {
                  const isSelected = isSameMonth(month, selectedMonth)
                  const isThisMonth = isSameMonth(month, currentMonthStart)
                  return (
                    <button
                      key={month.toISOString()}
                      onClick={() => {
                        setSelectedMonth(startOfMonth(month))
                        setShowMonthPicker(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]',
                        isSelected
                          ? 'bg-violet-600 text-white'
                          : 'text-zinc-300 hover:bg-zinc-800/70'
                      )}
                    >
                      <span className="capitalize">
                        {format(month, 'MMMM yyyy', { locale: es })}
                      </span>
                      {isThisMonth && !isSelected && (
                        <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                          Actual
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[10px] font-bold text-white/70">✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── DELETE DRAWER ─────────────────────────────────── */}
      {selectedTx && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => !deleting && setSelectedTx(null)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Opciones del registro"
            className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="max-w-md mx-auto rounded-t-3xl border-t border-x border-zinc-800 bg-zinc-950 px-5 pt-5 pb-6">
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto mb-5" />

              {/* Transaction detail */}
              <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-zinc-800">
                <span
                  className={cn(
                    'flex items-center justify-center w-12 h-12 rounded-2xl shrink-0',
                    TYPE_COLOR[selectedTx.type]
                  )}
                >
                  {(() => {
                    const Icon = TYPE_ICON[selectedTx.type]
                    return <Icon size={22} strokeWidth={2} />
                  })()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-zinc-100 truncate">
                    {selectedTx.concept}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {format(parseISO(selectedTx.transaction_date), "d 'de' MMMM yyyy", { locale: es })}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(selectedTx.category as any)?.name
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ? ` · ${(selectedTx.category as any).name}`
                      : ''}
                  </p>
                </div>
                <span className={cn('text-lg font-bold shrink-0', TYPE_AMOUNT_COLOR[selectedTx.type])}>
                  {AMOUNT_SIGN[selectedTx.type]}{formatCurrency(selectedTx.amount)}
                </span>
              </div>

              {/* Error */}
              {deleteError && (
                <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in">
                  <AlertTriangle size={15} />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Notas */}
              {selectedTx.notes && (
                <p className="text-sm text-zinc-500 italic mb-5 px-1">
                  "{selectedTx.notes}"
                </p>
              )}

              {/* Acciones */}
              <div className="space-y-2.5">
                <button
                  id="btn-delete-confirm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full h-13 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-base font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {deleting ? (
                    <><Loader2 size={18} className="animate-spin" /> Eliminando…</>
                  ) : (
                    <><Trash2 size={18} strokeWidth={2} /> Eliminar registro</>
                  )}
                </button>

                <button
                  id="btn-delete-cancel"
                  onClick={() => setSelectedTx(null)}
                  disabled={deleting}
                  className="w-full py-3.5 rounded-2xl text-zinc-500 text-sm font-semibold hover:text-zinc-300 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <X size={15} />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
