// POST /api/bank/connect — inicia la autorización PSD2 y devuelve la URL del banco.
// Body: { bank: string, accountId?: string | null }
//   accountId = cuenta de Omegus donde importar (si no, se crea una nueva al volver).
import { describeEbError, listAspsps, startAuthorization } from '@/lib/bank/enableBanking'
import { bankJson, requireBankUser, siteUrl } from '@/lib/bank/guard'

export const dynamic = 'force-dynamic'

const MAX_VALIDITY_S = 90 * 86400 // 90 días

export async function POST(req: Request) {
  const auth = await requireBankUser(req, { write: true })
  if (auth instanceof Response) return auth

  let body: { bank?: unknown; accountId?: unknown }
  try {
    body = await req.json()
  } catch {
    return bankJson({ error: 'Petición no válida' }, 400)
  }
  const bank = typeof body.bank === 'string' ? body.bank : ''
  const accountId = typeof body.accountId === 'string' && body.accountId ? body.accountId : null
  if (!bank) return bankJson({ error: 'Elige un banco' }, 400)

  const redirectUrl = siteUrl('/api/bank/callback')
  if (!redirectUrl) return bankJson({ error: 'Falta NEXT_PUBLIC_SITE_URL en la configuración.' }, 500)

  try {
    // Solo bancos de la lista oficial (evita enviar nombres arbitrarios)
    const aspsp = (await listAspsps('ES')).find((a) => a.name === bank)
    if (!aspsp) return bankJson({ error: 'Ese banco no está disponible.' }, 400)

    if (accountId) {
      const { data } = await auth.db.from('accounts').select('id').eq('id', accountId).maybeSingle()
      if (!data) return bankJson({ error: 'La cuenta elegida no existe.' }, 400)
    }

    const validity = Math.min(MAX_VALIDITY_S, aspsp.maximum_consent_validity ?? MAX_VALIDITY_S)
    const state = crypto.randomUUID()
    const { url } = await startAuthorization({
      aspspName: aspsp.name,
      country: aspsp.country,
      validUntil: new Date(Date.now() + (validity - 60) * 1000),
      state,
      redirectUrl,
    })

    const res = bankJson({ url })
    // El state viaja también en una cookie httpOnly: al volver se comprueba que la
    // autorización la inició este mismo navegador y usuario (anti-CSRF).
    res.headers.append(
      'Set-Cookie',
      `eb_flow=${encodeURIComponent(JSON.stringify({ s: state, a: accountId, u: auth.userId }))}; ` +
        `Path=/; Max-Age=900; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    )
    return res
  } catch (err) {
    console.error('[bank] connect:', err)
    return bankJson({ error: describeEbError(err) }, 502)
  }
}
