/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/bank/callback — vuelta del banco con ?code=&state=.
// Crea la sesión en Enable Banking, guarda las cuentas en bank_connections (enlazadas
// a una cuenta de Omegus) y redirige a /ajustes?bank=connected.
import { NextResponse, type NextRequest } from 'next/server'
import {
  createSession,
  deleteSession,
  type EbAccount,
  type EbSession,
} from '@/lib/bank/enableBanking'
import { requireBankUser, siteUrl } from '@/lib/bank/guard'

export const dynamic = 'force-dynamic'

const MAX_ACCOUNTS = 10
const DEFAULT_VALIDITY_MS = 90 * 86400_000

const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// "ES12 •••• •••• 1234": solo se conserva el país y los 4 últimos dígitos
function maskIban(iban: string | undefined): string | null {
  if (!iban) return null
  const clean = iban.replace(/\s+/g, '')
  return `${clean.slice(0, 2)}•• •••• •••• ${clean.slice(-4)}`
}

export async function GET(request: NextRequest) {
  const back = (status: string, reason?: string) => {
    const path = `/ajustes?bank=${status}${reason ? `&reason=${reason}` : ''}`
    const target = siteUrl(path)
    let url: URL
    if (target) {
      url = new URL(target)
    } else {
      url = request.nextUrl.clone()
      url.pathname = '/ajustes'
      url.search = `?bank=${status}${reason ? `&reason=${reason}` : ''}`
    }
    const res = NextResponse.redirect(url)
    res.cookies.delete('eb_flow')
    return res
  }

  const auth = await requireBankUser(request)
  if (auth instanceof Response) return auth
  const { db, userId } = auth

  const params = request.nextUrl.searchParams
  if (params.get('error')) return back('denied') // el usuario canceló o el banco rechazó

  const code = params.get('code')
  const state = params.get('state')

  let flow: { s?: string; a?: string | null; u?: string } = {}
  try {
    flow = JSON.parse(decodeURIComponent(request.cookies.get('eb_flow')?.value ?? ''))
  } catch {
    /* cookie ausente o corrupta */
  }
  if (!code || !state || flow.s !== state || flow.u !== userId) return back('error', 'state')

  let session: EbSession
  try {
    session = await createSession(code)
  } catch (err) {
    console.error('[bank] crear sesión:', (err as Error)?.message)
    return back('error', 'session')
  }

  try {
    const client = db as any
    const bank = session.aspsp?.name ?? 'Banco'
    const accounts: EbAccount[] = (session.accounts ?? []).slice(0, MAX_ACCOUNTS)
    const validUntil = session.access?.valid_until
      ? new Date(session.access.valid_until)
      : new Date(Date.now() + DEFAULT_VALIDITY_MS)
    const expiresAt = (Number.isNaN(validUntil.getTime()) ? new Date(Date.now() + DEFAULT_VALIDITY_MS) : validUntil).toISOString()

    // Cuenta de Omegus elegida al conectar (debe ser del usuario)
    let chosenAccountId: string | null = null
    if (flow.a) {
      const { data } = await client.from('accounts').select('id').eq('id', flow.a).maybeSingle()
      chosenAccountId = data?.id ?? null
    }

    const { data: maxRow } = await client
      .from('accounts')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextOrder = ((maxRow as { sort_order?: number } | null)?.sort_order ?? 0) + 1

    const replacedSessions = new Set<string>()

    for (const acc of accounts) {
      const iban = acc.account_id?.iban
      const accountKey = (await sha256Hex(`${iban ?? acc.identification_hash ?? acc.uid}`)).slice(0, 32)
      const masked = maskIban(iban)
      const last4 = iban ? iban.replace(/\s+/g, '').slice(-4) : null

      const { data: existing } = await client
        .from('bank_connections')
        .select('id, session_id, account_id')
        .eq('user_id', userId)
        .eq('account_key', accountKey)
        .maybeSingle()

      // Renovación: misma cuenta bancaria → se actualiza la conexión (y se conservan
      // la cuenta de Omegus y los movimientos ya importados)
      let omegusAccountId: string | null = existing?.account_id ?? null

      if (!omegusAccountId) {
        if (chosenAccountId) {
          omegusAccountId = chosenAccountId
          chosenAccountId = null // solo para la primera cuenta nueva
        } else {
          const name = accounts.length > 1 && last4 ? `${bank} ${last4}` : bank
          const { data: created, error: createErr } = await client
            .from('accounts')
            .insert({
              user_id: userId,
              name,
              type: 'bank',
              currency: 'EUR',
              color: '#3b82f6',
              icon: '🏦',
              sort_order: nextOrder++,
              is_active: true,
            })
            .select('id')
            .single()
          if (createErr) throw new Error(`crear cuenta: ${createErr.message}`)
          omegusAccountId = created.id
        }
      }

      const fields = {
        session_id: session.session_id,
        account_uid: acc.uid,
        account_id: omegusAccountId,
        bank_name: bank,
        iban_masked: masked,
        expires_at: expiresAt,
        last_error: null,
      }

      if (existing) {
        if (existing.session_id !== session.session_id) replacedSessions.add(existing.session_id)
        const { error } = await client.from('bank_connections').update(fields).eq('id', existing.id).eq('user_id', userId)
        if (error) throw new Error(`actualizar conexión: ${error.message}`)
      } else {
        const { error } = await client
          .from('bank_connections')
          .insert({ ...fields, user_id: userId, account_key: accountKey })
        if (error) throw new Error(`guardar conexión: ${error.message}`)
      }
    }

    // Sesiones antiguas que ya no usa ninguna cuenta: se revocan en el banco (best effort)
    for (const old of replacedSessions) {
      const { count } = await client
        .from('bank_connections')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', old)
      if (!count) await deleteSession(old).catch(() => undefined)
    }

    return back('connected')
  } catch (err) {
    console.error('[bank] guardar conexión:', (err as Error)?.message)
    // La sesión ya existe en el banco pero no se pudo guardar: se revoca para no dejarla huérfana
    await deleteSession(session.session_id).catch(() => undefined)
    return back('error', 'save')
  }
}
