// POST /api/bank/sync — importa los gastos recientes de las cuentas conectadas.
// Body: { connectionId?: string, auto?: boolean }
//   connectionId → solo esa sesión bancaria; sin él → todas las del usuario.
//   auto → sincronización en segundo plano (máx. 1 vez cada 6 h por cuenta).
import { bankJson, requireBankUser } from '@/lib/bank/guard'
import { syncConnection, type BankConnectionRow, type SyncOutcome } from '@/lib/bank/sync'
import type { CategoryLite } from '@/lib/bank/categorize'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireBankUser(req, { write: true })
  if (auth instanceof Response) return auth

  let connectionId = ''
  let autoMode = false
  try {
    const body = await req.json()
    connectionId = typeof body?.connectionId === 'string' ? body.connectionId : ''
    autoMode = body?.auto === true
  } catch {
    /* sin body: sincroniza todo en modo manual */
  }

  const { data, error } = await auth.db
    .from('bank_connections')
    .select('id, session_id, account_uid, account_key, account_id, bank_name, iban_masked, expires_at, last_synced_at, last_attempt_at')
    .eq('user_id', auth.userId)
  if (error) {
    console.error('[bank] leer conexiones:', error.message)
    return bankJson({ error: 'No se pudieron leer las conexiones bancarias.' }, 500)
  }

  let rows = (data ?? []) as BankConnectionRow[]
  if (connectionId) {
    const target = rows.find((r) => r.id === connectionId)
    if (!target) return bankJson({ error: 'La conexión no existe.' }, 404)
    rows = rows.filter((r) => r.session_id === target.session_id)
  }
  if (rows.length === 0) return bankJson({ ok: true, inserted: 0, results: [] })

  const { data: cats } = await auth.db
    .from('categories')
    .select('id, name, parent_id')
    .eq('transaction_type', 'expense')
    .eq('is_active', true)
  const categories = (cats ?? []) as CategoryLite[]

  // Con el usuario presente (botón) se envían sus cabeceras PSU: el banco lo trata
  // como consulta del cliente. En segundo plano no se envían (límite de 4/día).
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ua = req.headers.get('user-agent')
  const psuHeaders =
    !autoMode && ip ? { 'Psu-Ip-Address': ip, ...(ua ? { 'Psu-User-Agent': ua } : {}) } : undefined

  const results: SyncOutcome[] = []
  for (const row of rows) {
    results.push(await syncConnection(auth.db, auth.userId, row, categories, { auto: autoMode, psuHeaders }))
  }

  const inserted = results.reduce((n, r) => n + r.inserted, 0)
  const failed = results.filter((r) => r.status === 'error')
  return bankJson({ ok: failed.length === 0, inserted, results })
}
