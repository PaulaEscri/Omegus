// SOLO SERVIDOR. Cliente mínimo de la API de Enable Banking (Open Banking PSD2).
//
// Autenticación: JWT RS256 firmado con la clave privada de la aplicación, usando
// Web Crypto (compatible con Cloudflare Workers, sin dependencias).
//
//   ENABLE_BANKING_APP_ID       id de la aplicación (va en el `kid` del JWT)
//   ENABLE_BANKING_PRIVATE_KEY  clave privada RSA en PEM (secreto en Cloudflare)
//
// Omegus solo pide permiso de LECTURA (cuentas y movimientos): nunca recibe ni
// guarda credenciales bancarias.

const API_BASE = 'https://api.enablebanking.com'
const REQUEST_TIMEOUT_MS = 20_000
const JWT_TTL_SECONDS = 3600 // máximo permitido por Enable Banking: 24 h

export class EbError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'EbError'
  }
}

export function isBankingConfigured(): boolean {
  return !!process.env.ENABLE_BANKING_APP_ID && !!process.env.ENABLE_BANKING_PRIVATE_KEY
}

// ── Firma del JWT ────────────────────────────────────────────
const b64url = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const textB64url = (text: string) => b64url(new TextEncoder().encode(text))

function derLength(n: number): number[] {
  if (n < 0x80) return [n]
  const bytes: number[] = []
  for (let v = n; v > 0; v >>= 8) bytes.unshift(v & 0xff)
  return [0x80 | bytes.length, ...bytes]
}

// PKCS#1 (-----BEGIN RSA PRIVATE KEY-----) → PKCS#8, que es lo que importa Web Crypto
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const rsaAlgorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]
  const octet = [0x04, ...derLength(pkcs1.length)]
  const body = [0x02, 0x01, 0x00, ...rsaAlgorithm, ...octet]
  const total = body.length + pkcs1.length
  const out = new Uint8Array(1 + derLength(total).length + total)
  let o = 0
  out[o++] = 0x30
  for (const b of derLength(total)) out[o++] = b
  out.set(body, o)
  out.set(pkcs1, o + body.length)
  return out
}

let cachedKey: { pem: string; key: CryptoKey } | null = null

async function getSigningKey(): Promise<CryptoKey> {
  // En Cloudflare el PEM puede pegarse con "\n" literales o entre comillas
  const pem = (process.env.ENABLE_BANKING_PRIVATE_KEY ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n')
  if (cachedKey?.pem === pem) return cachedKey.key

  const isPkcs1 = pem.includes('BEGIN RSA PRIVATE KEY')
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  if (!b64) throw new EbError('ENABLE_BANKING_PRIVATE_KEY vacía o con formato incorrecto', 500, 'BAD_KEY')

  let der: Uint8Array
  try {
    der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  } catch {
    throw new EbError('ENABLE_BANKING_PRIVATE_KEY no es un PEM válido', 500, 'BAD_KEY')
  }
  if (isPkcs1) der = pkcs1ToPkcs8(der)

  try {
    const key = await crypto.subtle.importKey(
      'pkcs8',
      der as BufferSource,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )
    cachedKey = { pem, key }
    return key
  } catch {
    throw new EbError('No se pudo leer ENABLE_BANKING_PRIVATE_KEY (¿es una clave RSA PEM?)', 500, 'BAD_KEY')
  }
}

async function createJwt(): Promise<string> {
  const appId = process.env.ENABLE_BANKING_APP_ID
  if (!appId) throw new EbError('Falta ENABLE_BANKING_APP_ID', 500, 'NOT_CONFIGURED')
  const key = await getSigningKey()
  const iat = Math.floor(Date.now() / 1000)
  const header = textB64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }))
  const payload = textB64url(
    JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat, exp: iat + JWT_TTL_SECONDS })
  )
  const data = new TextEncoder().encode(`${header}.${payload}`)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data)
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`
}

// ── Petición genérica ────────────────────────────────────────
async function ebFetch<T>(
  path: string,
  opts: { method?: string; query?: Record<string, string | undefined>; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const url = new URL(API_BASE + path)
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v) url.searchParams.set(k, v)

  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${await createJwt()}`,
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof EbError) throw err
    const timeout = (err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError'
    throw new EbError(
      timeout ? 'Enable Banking no responde (tiempo agotado)' : 'No se pudo conectar con Enable Banking',
      timeout ? 504 : 502,
      timeout ? 'TIMEOUT' : 'NETWORK'
    )
  }

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* cuerpo no JSON */
  }

  if (!res.ok) {
    const e = (data ?? {}) as { message?: string; error?: string; code?: number }
    throw new EbError(e.message ?? `Enable Banking respondió ${res.status}`, res.status, e.error)
  }
  return data as T
}

// ── Endpoints ────────────────────────────────────────────────
export interface Aspsp {
  name: string
  country: string
  psu_types?: string[]
  maximum_consent_validity?: number // segundos
}

let aspspCache: { at: number; country: string; data: Aspsp[] } | null = null

export async function listAspsps(country = 'ES'): Promise<Aspsp[]> {
  if (aspspCache && aspspCache.country === country && Date.now() - aspspCache.at < 3600_000) {
    return aspspCache.data
  }
  const res = await ebFetch<{ aspsps: Aspsp[] }>('/aspsps', { query: { country } })
  const data = (res.aspsps ?? []).filter((a) => !a.psu_types || a.psu_types.includes('personal'))
  aspspCache = { at: Date.now(), country, data }
  return data
}

export async function startAuthorization(input: {
  aspspName: string
  country: string
  validUntil: Date
  state: string
  redirectUrl: string
}): Promise<{ url: string }> {
  return ebFetch<{ url: string }>('/auth', {
    method: 'POST',
    body: {
      access: { valid_until: input.validUntil.toISOString() },
      aspsp: { name: input.aspspName, country: input.country },
      state: input.state,
      redirect_url: input.redirectUrl,
      psu_type: 'personal',
      language: 'es',
    },
  })
}

export interface EbAccount {
  uid: string
  account_id?: { iban?: string } | null
  identification_hash?: string | null
  name?: string | null
  currency?: string | null
}

export interface EbSession {
  session_id: string
  accounts: EbAccount[]
  aspsp: { name: string; country: string }
  access?: { valid_until?: string }
}

export function createSession(code: string): Promise<EbSession> {
  return ebFetch<EbSession>('/sessions', { method: 'POST', body: { code } })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await ebFetch(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

export interface EbTransaction {
  entry_reference?: string | null
  transaction_id?: string | null
  transaction_amount: { amount: string; currency: string }
  credit_debit_indicator?: 'CRDT' | 'DBIT'
  status?: string
  booking_date?: string | null
  value_date?: string | null
  transaction_date?: string | null
  creditor?: { name?: string | null } | null
  remittance_information?: string[] | null
  note?: string | null
  bank_transaction_code?: { description?: string | null } | null
}

// Descarga los movimientos del rango, siguiendo la paginación (máx. 5 páginas)
export async function getTransactions(
  accountUid: string,
  dateFrom: string,
  dateTo: string,
  psuHeaders?: Record<string, string>
): Promise<EbTransaction[]> {
  const all: EbTransaction[] = []
  let continuationKey: string | undefined
  for (let page = 0; page < 5; page++) {
    const res = await ebFetch<{ transactions?: EbTransaction[]; continuation_key?: string | null }>(
      `/accounts/${encodeURIComponent(accountUid)}/transactions`,
      {
        query: { date_from: dateFrom, date_to: dateTo, continuation_key: continuationKey },
        headers: psuHeaders,
      }
    )
    all.push(...(res.transactions ?? []))
    continuationKey = res.continuation_key ?? undefined
    if (!continuationKey) break
  }
  return all
}

// Mensaje claro (en español) para un fallo de Enable Banking
export function describeEbError(err: unknown): string {
  if (!(err instanceof EbError)) return 'Error inesperado al hablar con el banco.'
  switch (err.code) {
    case 'EXPIRED_SESSION':
    case 'REVOKED_SESSION':
    case 'CLOSED_SESSION':
    case 'SESSION_DOES_NOT_EXIST':
    case 'WRONG_SESSION_STATUS':
      return 'La autorización con el banco ha caducado o se ha revocado. Vuelve a conectarlo.'
    case 'ASPSP_RATE_LIMIT_EXCEEDED':
      return 'El banco ha limitado las consultas (máximo 4 al día sin que estés presente). Inténtalo más tarde.'
    case 'ASPSP_TIMEOUT':
    case 'ASPSP_ERROR':
      return 'El banco no responde ahora mismo. Inténtalo en unos minutos.'
    case 'ASPSP_PSU_ACTION_REQUIRED':
      return 'El banco necesita que vuelvas a autorizar el acceso. Reconecta el banco.'
    case 'PSU_HEADER_NOT_PROVIDED':
      return 'Este banco solo permite sincronizar mientras estás presente: pulsa «Sincronizar ahora».'
    case 'REDIRECT_URI_NOT_ALLOWED':
      return 'La URL de retorno no está registrada en Enable Banking (revisa NEXT_PUBLIC_SITE_URL).'
    case 'BAD_KEY':
    case 'NOT_CONFIGURED':
      return `Configuración bancaria incompleta: ${err.message}.`
    case 'TIMEOUT':
    case 'NETWORK':
      return err.message
  }
  if (err.status === 401 || err.status === 403) {
    return 'Enable Banking rechaza las credenciales de la app (revisa ENABLE_BANKING_APP_ID y la clave privada).'
  }
  return `Enable Banking: ${err.message.slice(0, 160)}`
}
