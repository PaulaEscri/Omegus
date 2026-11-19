/* eslint-disable @typescript-eslint/no-explicit-any */
// SOLO SERVIDOR. Sincroniza los movimientos de las cuentas bancarias conectadas
// con la tabla `transactions` (solo gastos), sin duplicar (transactions.external_id).

import type { SupabaseClient } from '@supabase/supabase-js'
import { categorize, cleanMerchant, type CategoryLite } from './categorize'
import { describeEbError, EbError, getTransactions, type EbTransaction } from './enableBanking'

export const AUTO_SYNC_INTERVAL_MS = 6 * 3600_000 // respeta el límite PSD2 de 4 consultas/día
export const MANUAL_SYNC_COOLDOWN_MS = 30_000
const SYNC_DAYS = 15

export interface BankConnectionRow {
  id: string
  session_id: string
  account_uid: string
  account_key: string
  account_id: string | null
  bank_name: string
  iban_masked: string | null
  expires_at: string
  last_synced_at: string | null
  last_attempt_at: string | null
}

export interface SyncOutcome {
  connectionId: string
  bankName: string
  status: 'ok' | 'skipped' | 'error'
  inserted: number
  message?: string
}

const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

// Id estable del movimiento. Prioridad: entry_reference → transaction_id → huella del contenido
async function externalId(
  accountKey: string,
  tx: EbTransaction,
  amount: string,
  date: string,
  occurrence: Map<string, number>
): Promise<string> {
  const ref = tx.entry_reference?.trim() || tx.transaction_id?.trim()
  if (ref) return `eb:${accountKey}:${ref}`
  const base = [date, amount, tx.creditor?.name ?? '', (tx.remittance_information ?? []).join(' ')].join('|')
  const n = (occurrence.get(base) ?? 0) + 1 // dos compras idénticas el mismo día no se funden
  occurrence.set(base, n)
  return `eb:${accountKey}:h${(await sha256Hex(`${base}|${n}`)).slice(0, 24)}`
}

export async function syncConnection(
  db: SupabaseClient,
  userId: string,
  conn: BankConnectionRow,
  categories: CategoryLite[],
  opts: { auto: boolean; psuHeaders?: Record<string, string> }
): Promise<SyncOutcome> {
  const base = { connectionId: conn.id, bankName: conn.bank_name }
  const now = Date.now()
  const client = db as any

  if (new Date(conn.expires_at).getTime() <= now) {
    return { ...base, status: 'error', inserted: 0, message: 'La conexión ha caducado. Vuelve a conectar el banco.' }
  }
  if (!conn.account_id) {
    return { ...base, status: 'error', inserted: 0, message: 'La cuenta de destino ya no existe. Reconecta el banco.' }
  }

  // Límite de frecuencia (PSD2: 4 consultas/día sin el usuario presente)
  const last = conn.last_attempt_at ? new Date(conn.last_attempt_at).getTime() : 0
  const minGap = opts.auto ? AUTO_SYNC_INTERVAL_MS : MANUAL_SYNC_COOLDOWN_MS
  if (now - last < minGap) {
    return { ...base, status: 'skipped', inserted: 0, message: opts.auto ? 'Sincronizada hace menos de 6 h' : 'Espera unos segundos' }
  }

  // Se marca el intento ANTES de consultar: aunque falle, no se reintenta en bucle
  await client
    .from('bank_connections')
    .update({ last_attempt_at: new Date(now).toISOString() })
    .eq('id', conn.id)
    .eq('user_id', userId)

  try {
    const dateTo = isoDay(new Date(now))
    const dateFrom = isoDay(new Date(now - SYNC_DAYS * 86400_000))
    const txs = await getTransactions(conn.account_uid, dateFrom, dateTo, opts.psuHeaders)

    const occurrence = new Map<string, number>()
    const rows: Record<string, unknown>[] = []
    let foreign = 0

    for (const tx of txs) {
      if (tx.status && tx.status !== 'BOOK') continue // solo movimientos contabilizados
      const raw = Number(tx.transaction_amount?.amount)
      if (!Number.isFinite(raw) || raw === 0) continue
      const isDebit = tx.credit_debit_indicator ? tx.credit_debit_indicator === 'DBIT' : raw < 0
      if (!isDebit) continue // solo gastos
      if ((tx.transaction_amount.currency ?? 'EUR') !== 'EUR') {
        foreign++ // sumar divisas distintas falsearía los totales
        continue
      }

      const amount = Math.round(Math.abs(raw) * 100) / 100
      const date = tx.booking_date || tx.value_date || tx.transaction_date || dateTo
      const merchant =
        cleanMerchant(tx.creditor?.name) ||
        cleanMerchant(tx.remittance_information?.[0]) ||
        cleanMerchant(tx.note) ||
        cleanMerchant(tx.bank_transaction_code?.description) ||
        'Movimiento bancario'
      const cat = categorize(`${tx.creditor?.name ?? ''} ${(tx.remittance_information ?? []).join(' ')}`, categories)

      rows.push({
        user_id: userId,
        type: 'expense',
        amount,
        currency: 'EUR',
        category_id: cat.category_id,
        subcategory_id: cat.subcategory_id,
        account_id: conn.account_id,
        destination_account_id: null,
        concept: merchant,
        ticker: null,
        quantity: null,
        notes: 'Importado del banco',
        transaction_date: date,
        is_recurring: false,
        tags: [],
        external_id: await externalId(conn.account_key, tx, String(amount), date, occurrence),
      })
    }

    let inserted = 0
    if (rows.length > 0) {
      // ignoreDuplicates: los movimientos ya importados (mismo external_id) se saltan
      const { data, error } = await client
        .from('transactions')
        .upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
        .select('id')
      if (error) throw new Error(`No se pudieron guardar los movimientos: ${error.message}`)
      inserted = data?.length ?? 0
    }

    await client
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', conn.id)
      .eq('user_id', userId)

    return {
      ...base,
      status: 'ok',
      inserted,
      message: foreign > 0 ? `${foreign} movimiento(s) en otra divisa no se han importado` : undefined,
    }
  } catch (err) {
    const message = err instanceof EbError ? describeEbError(err) : (err as Error)?.message || 'Error al sincronizar'
    console.error('[bank] sync:', conn.bank_name, err instanceof EbError ? `${err.status} ${err.code ?? ''}` : message)
    await client
      .from('bank_connections')
      .update({ last_error: message.slice(0, 300) })
      .eq('id', conn.id)
      .eq('user_id', userId)
    return { ...base, status: 'error', inserted: 0, message }
  }
}

// ¿Hay alguna cuenta conectada, vigente y sin consultar en las últimas 6 h?
// Barato (1 consulta). Si la tabla aún no existe o falla, devuelve false.
export async function isBankSyncDue(db: SupabaseClient): Promise<boolean> {
  if (!process.env.ENABLE_BANKING_APP_ID || !process.env.ENABLE_BANKING_PRIVATE_KEY) return false
  try {
    const { data, error } = await (db as any)
      .from('bank_connections')
      .select('expires_at, last_attempt_at')
    if (error || !data) return false
    const now = Date.now()
    return (data as { expires_at: string; last_attempt_at: string | null }[]).some(
      (r) =>
        new Date(r.expires_at).getTime() > now &&
        (!r.last_attempt_at || now - new Date(r.last_attempt_at).getTime() >= AUTO_SYNC_INTERVAL_MS)
    )
  } catch {
    return false
  }
}
