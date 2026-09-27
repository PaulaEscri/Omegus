'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, subDays, subWeeks, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import {
  CalendarIcon,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { cn, CONCEPT_SUGGESTIONS } from '@/lib/utils'
import {
  transactionSchema,
  transactionDefaultValues,
  type TransactionSchema,
  type TransactionFormInput,
} from '@/lib/validations/transaction.schema'
import { createTransaction } from '@/lib/queries/transactions'
import { useCategories } from '@/hooks/useCategories'
import { useAccounts } from '@/hooks/useAccounts'
import { TypeSelector } from './TypeSelector'
import { AmountInput } from './AmountInput'
import { AssetCombobox } from './AssetCombobox'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { TransactionType, Category } from '@/types/database'

// ── Tipos internos ───────────────────────────────────────────
interface TransactionFormProps {
  userId: string
  onSuccess?: () => void
}

// ── Componente ───────────────────────────────────────────────
export function TransactionForm({ userId, onSuccess }: TransactionFormProps) {
  const router = useRouter()
  const [showCalendar, setShowCalendar] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [amountStr, setAmountStr] = useState('')

  // ── React Hook Form ─────────────────────────────────────────
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TransactionFormInput, unknown, TransactionSchema>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      currency: 'EUR',
      transaction_date: new Date(),
      is_recurring: false,
      tags: [],
      subcategory_id: '',
      destination_account_id: '',
      notes: '',
    },
  })

  const watchType = watch('type')
  const watchCategoryId = watch('category_id')
  const watchDate = watch('transaction_date')

  // ── Datos remotos ───────────────────────────────────────────
  const { categories, isLoading: loadingCats } = useCategories(watchType)
  const { accounts, brokerAccounts, liquidAccounts, isLoading: loadingAccounts } = useAccounts()

  // Reset categoría al cambiar tipo
  useEffect(() => {
    setValue('category_id', '' as string)
    setValue('subcategory_id', '')
  }, [watchType, setValue])

  // Reset subcategoría al cambiar categoría
  useEffect(() => {
    setValue('subcategory_id', '')
  }, [watchCategoryId, setValue])

  // Calcular subcategorías activas
  const activeCategory = categories.find((c) => c.id === watchCategoryId)
  const subcategories: Category[] = activeCategory?.subcategories ?? []

  // Sugerencias de concepto para la categoría activa
  const conceptSuggestions: string[] = (() => {
    if (!activeCategory) return []
    const key = activeCategory.name.toLowerCase().replace(/\s+/g, '_')
    return CONCEPT_SUGGESTIONS[key] ?? []
  })()

  // ── Submit ──────────────────────────────────────────────────
  const onSubmit: SubmitHandler<TransactionSchema> = async (data) => {
    setSubmitState('loading')
    setErrorMsg('')

    try {
      await createTransaction(
        { ...data, amount: parseFloat(amountStr || '0') },
        userId
      )
      setSubmitState('success')
      setTimeout(() => {
        if (onSuccess) {
          onSuccess()
        } else {
          reset({ ...transactionDefaultValues, transaction_date: new Date() })
          setAmountStr('')
          setSubmitState('idle')
        }
      }, 1400)
    } catch (err) {
      setSubmitState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  // ── UI de estado (loading/success/error) ────────────────────
  if (submitState === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 size={40} className="text-emerald-400" strokeWidth={1.5} />
        </div>
        <p className="text-lg font-semibold text-zinc-100">¡Guardado!</p>
        <p className="text-sm text-zinc-500">La transacción se ha registrado correctamente</p>
      </div>
    )
  }

  // ── Render principal ────────────────────────────────────────
  return (
    <form
      id="transaction-form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5 pb-6"
    >
      {/* ── 1. TIPO ──────────────────────────────────────────── */}
      <section aria-labelledby="section-type">
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <TypeSelector
              value={field.value as TransactionType}
              onChange={(val) => {
                field.onChange(val)
              }}
            />
          )}
        />
      </section>

      {/* ── 2. IMPORTE ───────────────────────────────────────── */}
      <section aria-labelledby="section-amount">
        <Controller
          name="amount"
          control={control}
          render={() => (
            <AmountInput
              value={amountStr}
              onChange={(val) => {
                setAmountStr(val)
                setValue('amount', parseFloat(val) || 0, { shouldValidate: true })
              }}
              transactionType={watchType as TransactionType}
              error={errors.amount?.message}
            />
          )}
        />
      </section>

      {/* ── 3. FECHA ─────────────────────────────────────────── */}
      <section aria-labelledby="section-date">
        <label id="section-date" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Fecha
        </label>

        {/* Botones rápidos de fecha */}
        <div className="flex gap-2 mb-2">
          {[
            { label: 'Hoy', getValue: () => new Date(), id: 'btn-today' },
            { label: 'Ayer', getValue: () => subDays(new Date(), 1), id: 'btn-yesterday' },
            { label: '−1 sem', getValue: () => subWeeks(new Date(), 1), id: 'btn-1week' },
            { label: '−1 mes', getValue: () => subMonths(new Date(), 1), id: 'btn-1month' },
          ].map(({ label, getValue, id }) => {
            const targetDate = getValue()
            const isActive = format(watchDate, 'yyyy-MM-dd') === format(targetDate, 'yyyy-MM-dd')
            return (
              <button
                key={id}
                type="button"
                id={id}
                aria-label={`Seleccionar ${label}`}
                onClick={() => {
                  setValue('transaction_date', targetDate, { shouldValidate: true })
                  setShowCalendar(false)
                }}
                className={cn(
                  'flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all duration-200 active:scale-95',
                  isActive
                    ? 'bg-violet-500/15 border-violet-500 text-violet-300'
                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Botón selector de fecha con calendario */}
        <button
          type="button"
          id="btn-calendar"
          aria-expanded={showCalendar}
          aria-haspopup="dialog"
          onClick={() => setShowCalendar((v) => !v)}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2',
            'bg-zinc-900/60 border-zinc-800 text-zinc-200',
            'transition-all duration-200 hover:border-zinc-600',
            'active:scale-[0.98]',
            showCalendar && 'border-zinc-600'
          )}
        >
          <span className="text-sm font-medium">
            {format(watchDate, "d 'de' MMMM yyyy", { locale: es })}
          </span>
          <CalendarIcon size={16} className="text-zinc-500" />
        </button>

        {/* Calendar desplegable con dropdown de mes/año */}
        {showCalendar && (
          <div
            role="dialog"
            aria-label="Seleccionar fecha"
            className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden animate-slide-up"
          >
            {/* Estilos para los selects nativos del dropdown */}
            <style>{`
              .rdp-dropdown select {
                background: #18181b;
                color: #e4e4e7;
                border: 1px solid #3f3f46;
                border-radius: 8px;
                padding: 4px 8px;
                font-size: 13px;
                outline: none;
                cursor: pointer;
              }
              .rdp-dropdown select:focus {
                border-color: #8b5cf6;
              }
            `}</style>
            <Controller
              name="transaction_date"
              control={control}
              render={({ field }) => (
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={(date) => {
                    if (date) {
                      field.onChange(date)
                      setShowCalendar(false)
                    }
                  }}
                  captionLayout="dropdown"
                  startMonth={new Date(2020, 0)}
                  endMonth={new Date()}
                  disabled={(date) => date > new Date()}
                  locale={es}
                  className="w-full"
                  classNames={{
                    months: 'flex flex-col sm:flex-row gap-4 p-3',
                    month_caption: 'flex justify-center pt-1 relative items-center mb-4',
                    caption_label: 'text-sm font-semibold text-zinc-200 capitalize',
                    dropdowns: 'flex items-center gap-2',
                    dropdown_root: 'rdp-dropdown',
                    nav: 'flex items-center gap-1',
                    button_previous: cn(
                      'absolute left-1 top-0 h-7 w-7 rounded-lg flex items-center justify-center',
                      'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors'
                    ),
                    button_next: cn(
                      'absolute right-1 top-0 h-7 w-7 rounded-lg flex items-center justify-center',
                      'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors'
                    ),
                    weeks: 'w-full',
                    weekdays: 'flex',
                    weekday: 'text-zinc-600 text-[10px] font-medium w-9 text-center uppercase',
                    week: 'flex w-full mt-1',
                    day: cn(
                      'h-9 w-9 text-center text-sm p-0 relative rounded-lg',
                      'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
                      'transition-colors cursor-pointer select-none'
                    ),
                    day_button: 'h-9 w-9 p-0 font-normal rounded-lg',
                    selected: 'bg-violet-600 text-white hover:bg-violet-500 rounded-lg font-semibold',
                    today: 'text-violet-400 font-bold',
                    outside: 'text-zinc-700 hover:bg-transparent cursor-default',
                    disabled: 'text-zinc-700 cursor-not-allowed hover:bg-transparent',
                    range_middle: 'rounded-none',
                  }}
                />
              )}
            />
          </div>
        )}
        {errors.transaction_date && (
          <p role="alert" className="mt-1.5 text-xs text-red-400 px-1">
            {errors.transaction_date.message}
          </p>
        )}
      </section>

      {/* ── 4. CATEGORÍA ─────────────────────────────────────── */}
      <section aria-labelledby="section-category">
        <label id="section-category" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Categoría
        </label>

        {loadingCats ? (
          <div className="flex items-center gap-2 h-12 px-4 rounded-xl border border-zinc-800 bg-zinc-900/60">
            <Loader2 size={16} className="animate-spin text-zinc-600" />
            <span className="text-sm text-zinc-600">Cargando...</span>
          </div>
        ) : (
          <Controller
            name="category_id"
            control={control}
            render={({ field }) => (
              <div className="relative">
                <select
                  id="category-select"
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-invalid={!!errors.category_id}
                  className={cn(
                    'w-full appearance-none px-4 py-3.5 pr-10 rounded-xl border-2',
                    'bg-zinc-900/80 text-zinc-200 text-sm font-medium',
                    'transition-all duration-200 outline-none cursor-pointer',
                    errors.category_id
                      ? 'border-red-500/60'
                      : 'border-zinc-800 focus:border-zinc-600',
                    !field.value && 'text-zinc-500'
                  )}
                >
                  <option value="" disabled>Selecciona categoría…</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
                {errors.category_id && (
                  <p role="alert" className="mt-1.5 text-xs text-red-400 px-1">
                    {errors.category_id.message}
                  </p>
                )}
              </div>
            )}
          />
        )}

        {/* Subcategoría (en cascada, solo si hay subcategorías) */}
        {subcategories.length > 0 && (
          <div className="mt-2 relative">
            <Controller
              name="subcategory_id"
              control={control}
              render={({ field }) => (
                <>
                  <select
                    id="subcategory-select"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    className={cn(
                      'w-full appearance-none px-4 py-3 pr-10 rounded-xl border-2',
                      'bg-zinc-900/60 text-zinc-300 text-sm',
                      'border-zinc-800/60 focus:border-zinc-700 outline-none cursor-pointer',
                      'transition-all duration-200',
                      !field.value && 'text-zinc-500'
                    )}
                  >
                    <option value="">Sin subcategoría (opcional)</option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
                  />
                </>
              )}
            />
          </div>
        )}
      </section>

      {/* ── 5. CONCEPTO / ACTIVO ─────────────────────────────── */}
      <section aria-labelledby="section-concept">
        <label
          id="section-concept"
          htmlFor={watchType === 'savings' ? 'concept-asset-input' : 'concept-input'}
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2"
        >
          {watchType === 'savings' ? '📈 Activo / Ticker' : 'Concepto (Opcional)'}
        </label>

        <Controller
          name="concept"
          control={control}
          render={({ field }) => (
            <div>
              {watchType === 'savings' ? (
                /* ── Combobox libre para activos de inversión ─────────── */
                <AssetCombobox
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={errors.concept?.message}
                />
              ) : (
                /* ── Input normal para ingresos y gastos ──────────────── */
                <>
                  <input
                    {...field}
                    id="concept-input"
                    type="text"
                    placeholder="Ej: Compra semanal (Opcional)"
                    autoComplete="off"
                    aria-invalid={!!errors.concept}
                    aria-describedby={errors.concept ? 'concept-error' : undefined}
                    className={cn(
                      'w-full px-4 py-3.5 rounded-xl border-2 outline-none',
                      'bg-zinc-900/80 text-zinc-100 text-sm placeholder:text-zinc-600',
                      'transition-all duration-200',
                      errors.concept
                        ? 'border-red-500/60'
                        : 'border-zinc-800 focus:border-zinc-600'
                    )}
                  />
                  {errors.concept && (
                    <p id="concept-error" role="alert" className="mt-1.5 text-xs text-red-400 px-1">
                      {errors.concept.message}
                    </p>
                  )}

                  {/* Chips de sugerencias */}
                  {conceptSuggestions.length > 0 && !field.value && (
                    <div
                      role="group"
                      aria-label="Sugerencias de concepto"
                      className="flex flex-wrap gap-1.5 mt-2"
                    >
                      {conceptSuggestions.slice(0, 5).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => field.onChange(s)}
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium',
                            'bg-zinc-800 text-zinc-400 border border-zinc-700',
                            'hover:bg-zinc-700 hover:text-zinc-200 hover:border-zinc-600',
                            'active:scale-95 transition-all duration-150'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        />
      </section>


      {/* ── 6. CUENTA ────────────────────────────────────────── */}
      <section aria-labelledby="section-account">
        <label id="section-account" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          {watchType === 'savings' ? 'Cuenta origen' : watchType === 'income' ? 'Cuenta destino' : 'Cuenta'}
        </label>

        {loadingAccounts ? (
          <div className="flex items-center gap-2 h-12 px-4 rounded-xl border border-zinc-800 bg-zinc-900/60">
            <Loader2 size={16} className="animate-spin text-zinc-600" />
          </div>
        ) : (
          <Controller
            name="account_id"
            control={control}
            render={({ field }) => (
              <div>
                {/* Chips de cuenta (más rápido que un select en móvil) */}
                <div
                  role="group"
                  aria-label="Seleccionar cuenta"
                  className="grid grid-cols-2 gap-2"
                >
                  {(watchType === 'savings' ? liquidAccounts : accounts).map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      aria-pressed={field.value === acc.id}
                      onClick={() => field.onChange(acc.id)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2',
                        'text-left text-sm font-medium transition-all duration-150 active:scale-95',
                        field.value === acc.id
                          ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                      )}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: acc.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{acc.name}</span>
                    </button>
                  ))}
                </div>
                {errors.account_id && (
                  <p role="alert" className="mt-1.5 text-xs text-red-400 px-1">
                    {errors.account_id.message}
                  </p>
                )}
              </div>
            )}
          />
        )}

        {/* Cuenta destino (solo savings) */}
        {watchType === 'savings' && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-zinc-600 mb-2">
              Cuenta destino (broker / inversión)
            </label>
            <Controller
              name="destination_account_id"
              control={control}
              render={({ field }) => (
                <div>
                  <div role="group" aria-label="Cuenta destino" className="grid grid-cols-2 gap-2">
                    {brokerAccounts.length > 0 ? (
                      brokerAccounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          aria-pressed={field.value === acc.id}
                          onClick={() => field.onChange(acc.id)}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2',
                            'text-left text-sm font-medium transition-all duration-150 active:scale-95',
                            field.value === acc.id
                              ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                              : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                          )}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: acc.color }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{acc.name}</span>
                        </button>
                      ))
                    ) : (
                      <p className="col-span-2 text-xs text-zinc-600 italic px-1">
                        No hay cuentas de tipo broker. Añade una en Configuración.
                      </p>
                    )}
                  </div>
                  {errors.destination_account_id && (
                    <p role="alert" className="mt-1.5 text-xs text-red-400 px-1">
                      {errors.destination_account_id.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        )}
      </section>

      {/* ── 7. NOTAS ─────────────────────────────────────────── */}
      <section aria-labelledby="section-notes">
        <label
          id="section-notes"
          htmlFor="notes-input"
          className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2"
        >
          Notas <span className="normal-case font-normal">(opcional)</span>
        </label>

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              id="notes-input"
              placeholder="Añade una nota si lo necesitas..."
              rows={2}
              className={cn(
                'resize-none bg-zinc-900/80 border-2 border-zinc-800',
                'text-zinc-300 placeholder:text-zinc-700 text-sm rounded-xl',
                'focus:border-zinc-600 outline-none transition-all duration-200'
              )}
            />
          )}
        />
      </section>

      {/* ── 8. ERROR GLOBAL ──────────────────────────────────── */}
      {submitState === 'error' && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in"
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── 9. BOTÓN GUARDAR ─────────────────────────────────── */}
      <Button
        type="submit"
        id="btn-submit-transaction"
        disabled={submitState === 'loading'}
        className={cn(
          'w-full h-14 rounded-2xl text-base font-bold',
          'transition-all duration-200 active:scale-[0.98]',
          watchType === 'income' && 'bg-emerald-600 hover:bg-emerald-500 text-white',
          watchType === 'expense' && 'bg-red-600 hover:bg-red-500 text-white',
          watchType === 'savings' && 'bg-blue-600 hover:bg-blue-500 text-white',
          submitState === 'loading' && 'opacity-70'
        )}
      >
        {submitState === 'loading' ? (
          <span className="flex items-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Guardando…
          </span>
        ) : (
          'Guardar transacción'
        )}
      </Button>
    </form>
  )
}
