/* eslint-disable @typescript-eslint/no-explicit-any */
// SOLO SERVIDOR. Capa de dominio del asistente: lecturas, borradores y ejecución.
//
// Reglas de seguridad (el modelo NUNCA ve SQL ni ids de usuario):
//  - Todo se ejecuta con el cliente Supabase DEL USUARIO (cookies de sesión) →
//    RLS limita cada consulta a sus propias filas. No se usa la service role.
//  - `user_id` lo pone el servidor, jamás el modelo.
//  - Escrituras: el modelo solo PROPONE (devuelve borrador + token firmado);
//    executeAction() se llama desde una server action tras pulsar "Confirmar".
//  - Sin borrados masivos: un id por acción.
//  - No hay acceso a `profiles` ni a ninguna tabla fuera de las listadas aquí.

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getPortfolioData } from '@/lib/queries/portfolio'
import { signAction, type ActionPayload } from './actionToken'
import type { ConfirmCard, DraftField, NeedsInfoCard } from './types'

export type Db = SupabaseClient<any, 'public', any>

// ── Utilidades ───────────────────────────────────────────────
const TZ = 'Europe/Madrid'

export function todayMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()) // YYYY-MM-DD
}

export function weekdayMadrid(): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'long' }).format(new Date())
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isRealDate = (s: string) =>
  ISO_DATE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const eur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

const round2 = (n: number) => Math.round(n * 100) / 100

export type Period = 'this_month' | 'last_month' | 'this_week' | 'last_30_days' | 'this_year' | 'all'

export function resolvePeriod(period?: Period, from?: string, to?: string) {
  const today = todayMadrid()
  if (from && to && isRealDate(from) && isRealDate(to)) return { from, to, label: `${from} → ${to}` }

  const [y, m] = today.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')

  switch (period ?? 'this_month') {
    case 'last_month': {
      const py = m === 1 ? y - 1 : y
      const pm = m === 1 ? 12 : m - 1
      const first = `${py}-${pad(pm)}-01`
      return { from: first, to: addDays(`${y}-${pad(m)}-01`, -1), label: 'mes pasado' }
    }
    case 'this_week': {
      const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7 // lunes = 0
      return { from: addDays(today, -dow), to: today, label: 'esta semana' }
    }
    case 'last_30_days':
      return { from: addDays(today, -29), to: today, label: 'últimos 30 días' }
    case 'this_year':
      return { from: `${y}-01-01`, to: today, label: 'este año' }
    case 'all':
      return { from: '1970-01-01', to: today, label: 'todo el histórico' }
    default:
      return { from: `${y}-${pad(m)}-01`, to: today, label: 'este mes' }
  }
}

// ── Catálogo (categorías y cuentas del usuario) ──────────────
export interface CategoryRow {
  id: string
  name: string
  parent_id: string | null
  transaction_type: 'income' | 'expense' | 'savings'
  sort_order: number
}
export interface AccountRow {
  id: string
  name: string
  type: string
  sort_order: number
}
export interface Catalog {
  categories: CategoryRow[]
  accounts: AccountRow[]
}

export async function loadCatalog(db: Db): Promise<Catalog> {
  const [cats, accs] = await Promise.all([
    db
      .from('categories')
      .select('id, name, parent_id, transaction_type, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
    db.from('accounts').select('id, name, type, sort_order').eq('is_active', true).order('sort_order'),
  ])
  return {
    categories: (cats.data as CategoryRow[] | null) ?? [],
    accounts: (accs.data as AccountRow[] | null) ?? [],
  }
}

const TYPE_LABEL = { income: 'Ingreso', expense: 'Gasto', savings: 'Ahorro/Inversión' } as const

// Texto compacto para el system prompt (evita llamadas a list_categories)
export function catalogForPrompt(c: Catalog): string {
  const lines: string[] = []
  for (const type of ['expense', 'income', 'savings'] as const) {
    const ofType = c.categories.filter((x) => x.transaction_type === type)
    const roots = ofType.filter((x) => !x.parent_id)
    if (roots.length === 0) continue
    const parts = roots.map((r) => {
      const subs = ofType.filter((x) => x.parent_id === r.id).map((s) => s.name)
      return subs.length ? `${r.name} (${subs.join(', ')})` : r.name
    })
    lines.push(`- ${TYPE_LABEL[type]}: ${parts.join('; ')}`)
  }
  const accs = c.accounts.length ? c.accounts.map((a) => a.name).join(', ') : '(ninguna)'
  return `Categorías:\n${lines.join('\n') || '(ninguna)'}\nCuentas: ${accs}`
}

function matchByName<T extends { name: string }>(items: T[], name?: string | null) {
  if (!name || !name.trim()) return { match: null as T | null, candidates: [] as T[] }
  const n = norm(name)
  const exact = items.find((i) => norm(i.name) === n)
  if (exact) return { match: exact, candidates: [exact] }
  const candidates = items.filter((i) => {
    const x = norm(i.name)
    return x.includes(n) || n.includes(x)
  })
  return { match: candidates.length === 1 ? candidates[0] : null, candidates }
}

const isMissingTable = (err: any) => err?.code === 'PGRST205' || err?.code === '42P01'

async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>,
  maxPages = 5
): Promise<any[]> {
  const out: any[] = []
  for (let p = 0; p < maxPages; p++) {
    const { data, error } = await build(p * 1000, p * 1000 + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

// ── LECTURAS ─────────────────────────────────────────────────
export async function getSummary(
  db: Db,
  cat: Catalog,
  a: { period?: Period; date_from?: string; date_to?: string }
) {
  const range = resolvePeriod(a.period, a.date_from, a.date_to)
  const rows = await fetchAll((f, t) =>
    db
      .from('transactions')
      .select('type, amount, category_id')
      .gte('transaction_date', range.from)
      .lte('transaction_date', range.to)
      .range(f, t)
  )

  const totals = { income: 0, expense: 0, savings: 0 }
  const byCat = new Map<string, number>()
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    totals[r.type as keyof typeof totals] += amt
    if (r.type === 'expense' && r.category_id) {
      byCat.set(r.category_id, (byCat.get(r.category_id) ?? 0) + amt)
    }
  }
  const nameOf = (id: string) => cat.categories.find((c) => c.id === id)?.name ?? 'Sin categoría'
  const top = [...byCat.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5)
    .map(([id, total]) => ({ category: nameOf(id), total: round2(total) }))

  return {
    period: range.label,
    from: range.from,
    to: range.to,
    transactions: rows.length,
    income: round2(totals.income),
    expenses: round2(totals.expense),
    savings_invested: round2(totals.savings),
    balance_income_minus_expenses: round2(totals.income - totals.expense),
    top_expense_categories: top,
  }
}

export async function listTransactions(
  db: Db,
  cat: Catalog,
  a: {
    period?: Period
    date_from?: string
    date_to?: string
    type?: 'income' | 'expense' | 'savings'
    category?: string
    text?: string
    min_amount?: number
    max_amount?: number
    limit?: number
  }
) {
  const range = resolvePeriod(a.period ?? 'last_30_days', a.date_from, a.date_to)
  const limit = Math.min(Math.max(a.limit ?? 15, 1), 25)

  let q = db
    .from('transactions')
    .select(
      'id, type, amount, concept, transaction_date, category_id, subcategory_id, account:accounts!account_id(name)'
    )
    .gte('transaction_date', range.from)
    .lte('transaction_date', range.to)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (a.type) q = q.eq('type', a.type)
  if (a.min_amount != null) q = q.gte('amount', a.min_amount)
  if (a.max_amount != null) q = q.lte('amount', a.max_amount)
  if (a.text?.trim()) {
    const safe = a.text.trim().replace(/[\\%_,()]/g, ' ')
    q = q.ilike('concept', `%${safe}%`)
  }
  if (a.category) {
    const m = matchByName(cat.categories, a.category)
    const ids = new Set<string>()
    for (const c of m.candidates) {
      ids.add(c.id)
      cat.categories.filter((x) => x.parent_id === c.id).forEach((s) => ids.add(s.id))
    }
    if (ids.size === 0) return { period: range.label, count: 0, transactions: [], note: 'Categoría no encontrada' }
    const list = [...ids].join(',')
    q = q.or(`category_id.in.(${list}),subcategory_id.in.(${list})`)
  }

  const { data, error } = await q
  if (error) throw error
  const nameOf = (id: string | null) => (id ? cat.categories.find((c) => c.id === id)?.name : undefined)

  return {
    period: range.label,
    count: data?.length ?? 0,
    transactions: (data ?? []).map((r: any) => ({
      id: r.id,
      date: r.transaction_date,
      type: r.type,
      amount: round2(Number(r.amount)),
      concept: r.concept,
      category: nameOf(r.subcategory_id) ?? nameOf(r.category_id) ?? null,
      account: r.account?.name ?? null,
    })),
  }
}

export async function listPlaces(db: Db, a: { text?: string }) {
  let q = db.from('places').select('id, name, address').eq('is_active', true).order('name').limit(30)
  if (a.text?.trim()) q = q.ilike('name', `%${a.text.trim().replace(/[\\%_,()]/g, ' ')}%`)
  const { data, error } = await q
  if (error) {
    if (isMissingTable(error)) return { error: 'La función de lugares aún no está disponible' }
    throw error
  }
  return { count: data?.length ?? 0, places: data ?? [] }
}

export async function getBudgets(db: Db, cat: Catalog, categoryFilter?: string) {
  const { data: budgets, error } = await db
    .from('budgets')
    .select('id, category_id, period, amount, currency')
    .eq('is_active', true)
  if (error) {
    if (isMissingTable(error)) return { error: 'La función de presupuestos aún no está disponible' }
    throw error
  }
  if (!budgets || budgets.length === 0) return { count: 0, budgets: [] }

  const wanted = categoryFilter?.trim() ? norm(categoryFilter) : null
  const periodMap: Record<string, Period> = { weekly: 'this_week', monthly: 'this_month', yearly: 'this_year' }
  const out = []
  for (const b of budgets as any[]) {
    if (wanted) {
      const n = b.category_id ? norm(cat.categories.find((c) => c.id === b.category_id)?.name ?? '') : 'total gastos'
      if (!n.includes(wanted) && !wanted.includes(n)) continue
    }
    const range = resolvePeriod(periodMap[b.period] ?? 'this_month')
    const ids = new Set<string>()
    if (b.category_id) {
      ids.add(b.category_id)
      cat.categories.filter((c) => c.parent_id === b.category_id).forEach((s) => ids.add(s.id))
    }
    const rows = await fetchAll((f, t) => {
      let q = db
        .from('transactions')
        .select('amount')
        .eq('type', 'expense')
        .gte('transaction_date', range.from)
        .lte('transaction_date', range.to)
        .range(f, t)
      if (b.category_id) q = q.in('category_id', [...ids])
      return q
    })
    const spent = round2(rows.reduce((s, r) => s + Number(r.amount), 0))
    const amount = Number(b.amount)
    out.push({
      category: b.category_id
        ? (cat.categories.find((c) => c.id === b.category_id)?.name ?? 'Categoría')
        : 'Total gastos',
      period: b.period,
      budget: amount,
      spent,
      remaining: round2(amount - spent),
      percent_used: amount > 0 ? Math.round((spent / amount) * 100) : 0,
    })
  }
  return { count: out.length, budgets: out }
}

export async function getPortfolio(db: Db, assetFilter?: string) {
  const { assets: all, totalInvested } = await getPortfolioData(db as any)
  const wanted = assetFilter?.trim() ? norm(assetFilter) : null
  const assets = wanted
    ? all.filter((x) => norm(x.concept).includes(wanted) || norm(x.ticker ?? '') === wanted)
    : all
  return {
    total_invested: round2(totalInvested),
    assets: assets.slice(0, 15).map((x) => ({
      name: x.concept,
      ticker: x.ticker,
      invested: x.totalInvested,
      quantity: x.quantity,
    })),
    note: 'Valores según lo invertido; la cotización en vivo se ve en la pestaña Cartera.',
  }
}

// ── PROPUESTAS (no escriben) ─────────────────────────────────
export interface TxArgs {
  type: 'income' | 'expense' | 'savings'
  amount: number
  concept?: string
  category?: string
  account?: string
  destination_account?: string
  date?: string
  notes?: string
  place?: string
  ticker?: string
  quantity?: number
  use_defaults?: boolean
}

export type ProposalOutcome =
  | { status: 'needs_info'; card: NeedsInfoCard; context: string; result: Record<string, unknown> }
  | { status: 'ready'; card: ConfirmCard; context: string; result: Record<string, unknown> }
  | { status: 'error'; result: { error: string } }

const FIELD_LABEL: Record<DraftField, string> = {
  category: 'la categoría',
  account: 'la cuenta',
  destination_account: 'la cuenta destino',
}

export async function proposeTransaction(
  db: Db,
  userId: string,
  cat: Catalog,
  a: TxArgs
): Promise<ProposalOutcome> {
  const err = (error: string): ProposalOutcome => ({ status: 'error', result: { error } })

  if (!(a.amount > 0) || a.amount > 9_999_999) return err('Importe no válido')
  const today = todayMadrid()
  const date = a.date && isRealDate(a.date) ? a.date : today
  if (date > today) return err('La fecha no puede ser futura')
  if (cat.accounts.length === 0) return err('El usuario no tiene cuentas; debe crear una en Ajustes')

  const ofType = cat.categories.filter((c) => c.transaction_type === a.type)
  const roots = ofType.filter((c) => !c.parent_id)

  const catM = matchByName(ofType, a.category)
  const accM = matchByName(cat.accounts, a.account)
  const destM = matchByName(cat.accounts, a.destination_account)

  let category = catM.match
  let account = accM.match
  let dest = destM.match
  const missing: DraftField[] = []

  if (!category) {
    if (a.use_defaults) {
      category = roots.find((r) => norm(r.name).startsWith('otro')) ?? roots[0] ?? null
    } else missing.push('category')
  }
  if (!account) {
    if (a.use_defaults) account = cat.accounts[0]
    else missing.push('account')
  }
  if (a.type === 'savings' && !dest) {
    if (a.use_defaults) {
      dest =
        cat.accounts.find((x) => x.type === 'broker' && x.id !== account?.id) ??
        cat.accounts.find((x) => x.id !== account?.id) ??
        null
    } else missing.push('destination_account')
  }

  const concept = (a.concept?.trim() || category?.name || TYPE_LABEL[a.type]).slice(0, 120)
  const summary = `${TYPE_LABEL[a.type]} ${eur(a.amount)} · ${concept}`

  if (missing.length > 0) {
    const field = missing[0]
    const options =
      field === 'category'
        ? (catM.candidates.length > 1 ? catM.candidates : roots).map((c) => c.name).slice(0, 10)
        : field === 'account'
          ? (accM.candidates.length > 1 ? accM.candidates : cat.accounts).map((x) => x.name)
          : cat.accounts.filter((x) => x.id !== account?.id).map((x) => x.name)

    const draft = { ...a, use_defaults: undefined }
    return {
      status: 'needs_info',
      card: { kind: 'needs_info', field, title: `¿Qué ${FIELD_LABEL[field].replace('la ', '')}?`, summary, options },
      context: `[Borrador pendiente, AÚN NO guardado: ${JSON.stringify(draft)}. Falta: ${missing.join(', ')}. Se han mostrado botones al usuario; al responder, vuelve a llamar a propose_transaction con TODOS los datos.]`,
      result: {
        status: 'needs_info',
        missing,
        message: 'Se han mostrado botones al usuario para elegir el dato que falta. No repitas la pregunta.',
      },
    }
  }

  // Ámbito de categoría: padre + subcategoría (como el formulario)
  const category_id = category!.parent_id ?? category!.id
  const subcategory_id = category!.parent_id ? category!.id : null
  const parentName = category!.parent_id ? cat.categories.find((c) => c.id === category!.parent_id)?.name : null

  // Lugar (opcional), se guarda en transactions.place_id:
  //  - si ya existe en places → se enlaza su id
  //  - si es nuevo → se crea AL CONFIRMAR (place_name) y se enlaza; la IA no escribe
  //  - si la tabla places no responde → respaldo: queda anotado en las notas
  let place_id: string | null = null
  let place_name: string | null = null
  let placeLabel: string | null = null
  let notes = a.notes?.trim() || ''
  if (a.place?.trim()) {
    const wanted = a.place.trim().slice(0, 120)
    const { data, error } = await db.from('places').select('id, name').eq('is_active', true)
    if (error) {
      placeLabel = wanted
      notes = [notes, `Lugar: ${wanted}`].filter(Boolean).join(' · ')
    } else {
      const m = matchByName((data as any[]) ?? [], wanted)
      if (m.match) {
        place_id = (m.match as any).id
        placeLabel = (m.match as any).name
      } else {
        place_name = wanted
        placeLabel = `${wanted} (nuevo)`
      }
    }
  }

  const payload = {
    type: a.type,
    amount: round2(a.amount),
    currency: 'EUR',
    category_id,
    subcategory_id,
    account_id: account!.id,
    destination_account_id: a.type === 'savings' ? (dest?.id ?? null) : null,
    concept,
    notes: notes ? notes.slice(0, 500) : null,
    transaction_date: date,
    place_id,
    place_name,
    ticker: a.ticker?.trim() ? a.ticker.trim().toUpperCase().slice(0, 15) : null,
    quantity: a.quantity && a.quantity > 0 ? a.quantity : null,
  }

  const lines = [
    { label: 'Tipo', value: TYPE_LABEL[a.type] },
    { label: 'Importe', value: eur(payload.amount) },
    { label: 'Concepto', value: concept },
    { label: 'Categoría', value: parentName ? `${parentName} › ${category!.name}` : category!.name },
    { label: 'Cuenta', value: dest ? `${account!.name} → ${dest.name}` : account!.name },
    { label: 'Fecha', value: date },
  ]
  if (placeLabel) lines.push({ label: 'Lugar', value: placeLabel })

  const token = await signAction('create_transaction', userId, payload)
  return {
    status: 'ready',
    card: { kind: 'confirm', action: 'create_transaction', title: 'Registrar movimiento', lines, token },
    context: `[Propuesta mostrada al usuario, pendiente de que pulse Confirmar: ${summary}.]`,
    result: {
      status: 'awaiting_user_confirmation',
      message: 'Propuesta mostrada con botones Confirmar/Cancelar. NO está guardado todavía. Responde con una frase muy corta.',
    },
  }
}

export async function proposePlace(
  db: Db,
  userId: string,
  a: { name: string; address?: string }
): Promise<ProposalOutcome> {
  const name = a.name.trim().slice(0, 120)
  if (!name) return { status: 'error', result: { error: 'Nombre vacío' } }

  const { data, error } = await db.from('places').select('id, name').eq('is_active', true)
  if (error) {
    return {
      status: 'error',
      result: { error: isMissingTable(error) ? 'La función de lugares aún no está disponible' : 'No se pudo consultar' },
    }
  }
  if (((data as any[]) ?? []).some((p) => norm(p.name) === norm(name))) {
    return { status: 'error', result: { error: 'Ese lugar ya existe' } }
  }

  const address = a.address?.trim() ? a.address.trim().slice(0, 300) : null
  const lines = [{ label: 'Nombre', value: name }]
  if (address) lines.push({ label: 'Dirección', value: address })

  const token = await signAction('create_place', userId, { name, address })
  return {
    status: 'ready',
    card: { kind: 'confirm', action: 'create_place', title: 'Añadir lugar', lines, token },
    context: `[Propuesta mostrada al usuario, pendiente de confirmar: añadir lugar "${name}".]`,
    result: {
      status: 'awaiting_user_confirmation',
      message: 'Propuesta mostrada con botones. NO está guardado todavía.',
    },
  }
}

export async function proposeDelete(
  db: Db,
  userId: string,
  cat: Catalog,
  a: { id: string }
): Promise<ProposalOutcome> {
  if (!z.string().uuid().safeParse(a.id).success) {
    return { status: 'error', result: { error: 'Id no válido: usa el id exacto de list_transactions' } }
  }
  const { data, error } = await db
    .from('transactions')
    .select('id, type, amount, concept, transaction_date, category_id, subcategory_id, account:accounts!account_id(name)')
    .eq('id', a.id)
    .maybeSingle()
  if (error || !data) return { status: 'error', result: { error: 'Movimiento no encontrado' } }

  const r = data as any
  const nameOf = (id: string | null) => (id ? cat.categories.find((c) => c.id === id)?.name : undefined)
  const lines = [
    { label: 'Fecha', value: r.transaction_date },
    { label: 'Importe', value: eur(Number(r.amount)) },
    { label: 'Concepto', value: r.concept || '—' },
    { label: 'Categoría', value: nameOf(r.subcategory_id) ?? nameOf(r.category_id) ?? '—' },
    { label: 'Cuenta', value: r.account?.name ?? '—' },
  ]

  const token = await signAction('delete_transaction', userId, { id: r.id })
  return {
    status: 'ready',
    card: { kind: 'confirm', action: 'delete_transaction', title: '¿Borrar este movimiento?', lines, destructive: true, token },
    context: `[Propuesta de BORRADO mostrada al usuario, pendiente de confirmar: ${eur(Number(r.amount))} · ${r.concept || 'sin concepto'} (${r.transaction_date}).]`,
    result: {
      status: 'awaiting_user_confirmation',
      message: 'Se pide confirmación al usuario con botones. NO está borrado. Responde con una frase muy corta.',
    },
  }
}

// ── EJECUCIÓN (solo tras Confirmar; la llama la server action) ─
const txPayload = z.object({
  type: z.enum(['income', 'expense', 'savings']),
  amount: z.number().positive().max(9_999_999),
  currency: z.string().default('EUR'),
  category_id: z.string().uuid(),
  subcategory_id: z.string().uuid().nullable(),
  account_id: z.string().uuid(),
  destination_account_id: z.string().uuid().nullable(),
  concept: z.string().max(120),
  notes: z.string().max(500).nullable(),
  transaction_date: z.string().regex(ISO_DATE),
  place_id: z.string().uuid().nullable(),
  place_name: z.string().min(1).max(120).nullish(),
  ticker: z.string().max(15).nullable(),
  quantity: z.number().positive().nullable(),
})

// Devuelve el id de un lugar por nombre; lo crea si no existe. Idempotente: el
// índice único (user_id, lower(btrim(name))) evita duplicados aunque se repita.
async function ensurePlace(db: Db, userId: string, name: string): Promise<string | null> {
  const lookup = async () => {
    const { data, error } = await db.from('places').select('id, name, is_active')
    if (error) return null
    return ((data as any[]) ?? []).find((p) => norm(p.name) === norm(name)) ?? null
  }

  const existing = await lookup()
  if (existing) {
    if (!existing.is_active) await db.from('places').update({ is_active: true }).eq('id', existing.id)
    return existing.id as string
  }

  const { data, error } = await db.from('places').insert({ user_id: userId, name }).select('id').single()
  if (!error && data) return (data as any).id as string
  if (error?.code === '23505') return ((await lookup())?.id as string | undefined) ?? null
  console.error('[ai] ensurePlace:', error?.message)
  return null
}

export type ExecResult = { ok: true; message: string } | { ok: false; message: string }

export async function executeAction(db: Db, userId: string, p: ActionPayload): Promise<ExecResult> {
  if (p.kind === 'create_transaction') {
    const parsed = txPayload.safeParse(p.data)
    if (!parsed.success) return { ok: false, message: 'Datos no válidos' }
    const d = parsed.data

    // Las FKs no comprueban propiedad: verificar que categorías/cuentas/lugar son del usuario (RLS filtra)
    const catIds = [d.category_id, d.subcategory_id].filter((x): x is string => !!x)
    const accIds = [d.account_id, d.destination_account_id].filter((x): x is string => !!x)
    const [c, a] = await Promise.all([
      db.from('categories').select('id').in('id', catIds),
      db.from('accounts').select('id').in('id', accIds),
    ])
    if ((c.data?.length ?? 0) !== new Set(catIds).size || (a.data?.length ?? 0) !== new Set(accIds).size) {
      return { ok: false, message: 'Categoría o cuenta no válidas' }
    }
    if (d.place_id) {
      const pl = await db.from('places').select('id').eq('id', d.place_id).maybeSingle()
      if (!pl.data) d.place_id = null
    }
    if (!d.place_id && d.place_name) {
      d.place_id = await ensurePlace(db, userId, d.place_name)
    }

    const row: Record<string, unknown> = {
      id: p.nonce, // idempotente: pulsar dos veces no duplica
      user_id: userId,
      type: d.type,
      amount: d.amount,
      currency: d.currency,
      category_id: d.category_id,
      subcategory_id: d.subcategory_id,
      account_id: d.account_id,
      destination_account_id: d.destination_account_id,
      concept: d.concept,
      notes: d.notes,
      transaction_date: d.transaction_date,
      is_recurring: false,
      tags: [],
      ticker: d.ticker,
      quantity: d.quantity,
    }
    if (d.place_id) row.place_id = d.place_id

    const { error } = await db.from('transactions').insert(row)
    if (error) {
      if (error.code === '23505') return { ok: true, message: 'Ya estaba registrado' }
      console.error('[ai] insert transaction:', error.message)
      return { ok: false, message: 'No se pudo guardar' }
    }
    return { ok: true, message: `Registrado: ${eur(d.amount)} · ${d.concept}` }
  }

  if (p.kind === 'create_place') {
    const parsed = z
      .object({ name: z.string().min(1).max(120), address: z.string().max(300).nullable() })
      .safeParse(p.data)
    if (!parsed.success) return { ok: false, message: 'Datos no válidos' }
    const { error } = await db
      .from('places')
      .insert({ id: p.nonce, user_id: userId, name: parsed.data.name, address: parsed.data.address })
    if (error) {
      if (error.code === '23505') return { ok: true, message: 'Ese lugar ya existía' }
      console.error('[ai] insert place:', error.message)
      return { ok: false, message: 'No se pudo guardar el lugar' }
    }
    return { ok: true, message: `Lugar añadido: ${parsed.data.name}` }
  }

  if (p.kind === 'delete_transaction') {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(p.data)
    if (!parsed.success) return { ok: false, message: 'Datos no válidos' }
    const { data, error } = await db
      .from('transactions')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', userId)
      .select('id')
    if (error) {
      console.error('[ai] delete transaction:', error.message)
      return { ok: false, message: 'No se pudo borrar' }
    }
    if (!data || data.length !== 1) return { ok: false, message: 'No encontrado (¿ya estaba borrado?)' }
    return { ok: true, message: 'Movimiento borrado' }
  }

  return { ok: false, message: 'Acción desconocida' }
}
