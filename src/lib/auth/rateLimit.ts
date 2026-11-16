// ============================================================
// Límite de intentos de login — SOLO SERVIDOR
// ============================================================
// Cuenta intentos FALLIDOS por identificador (usuario/email) y por IP en una
// ventana de 15 minutos. Persiste en Supabase (tabla auth_rate_limits, ver
// supabase/migrations/20261116_login_rate_limit.sql) porque en Cloudflare
// Workers la memoria no se comparte entre instancias. Si la BD no está
// disponible o la migración no se ha aplicado, cae a un contador en memoria
// (mejor que nada) y NUNCA bloquea el login por un fallo propio. Nunca lanza.

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const WINDOW_SECONDS = 15 * 60
const MAX_FAILURES_PER_IDENTIFIER = 5
const MAX_FAILURES_PER_IP = 20

// ── Fallback en memoria ──────────────────────────────────────
const memory = new Map<string, { failures: number; start: number }>()

function memGet(key: string): number {
  const e = memory.get(key)
  if (!e || Date.now() - e.start > WINDOW_SECONDS * 1000) return 0
  return e.failures
}

function memAdd(key: string) {
  const e = memory.get(key)
  if (!e || Date.now() - e.start > WINDOW_SECONDS * 1000) {
    memory.set(key, { failures: 1, start: Date.now() })
  } else {
    e.failures += 1
  }
  // Evita crecimiento sin límite
  if (memory.size > 5000) memory.clear()
}

// ── Claves ───────────────────────────────────────────────────
async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getClientIp(): Promise<string> {
  try {
    const h = await headers()
    return (
      h.get('cf-connecting-ip') ??
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'
    )
  } catch {
    return 'unknown'
  }
}

export interface LoginRateKeys {
  identifierKey: string // se guarda hasheado: no almacenamos emails/usuarios en claro
  ipKey: string
}

export async function buildLoginKeys(identifier: string): Promise<LoginRateKeys> {
  const [idHash, ip] = await Promise.all([sha256Hex(identifier), getClientIp()])
  return { identifierKey: `login:id:${idHash}`, ipKey: `login:ip:${ip}` }
}

// ── RPC con fallback ─────────────────────────────────────────
// El tipo Database no declara estas funciones; se llama por RPC sin tipar.
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (createAdminClient() as any).rpc(fn, args)
    if (error) {
      console.error(`[rate-limit] ${fn}:`, error.message)
      return null
    }
    return data as T
  } catch (err) {
    console.error(`[rate-limit] ${fn}:`, err)
    return null
  }
}

async function failures(key: string): Promise<number> {
  const db = await rpc<number>('get_login_failures', {
    p_key: key,
    p_window_seconds: WINDOW_SECONDS,
  })
  return Math.max(db ?? 0, memGet(key))
}

// ── API pública ──────────────────────────────────────────────
export async function isLoginBlocked(keys: LoginRateKeys): Promise<boolean> {
  const [byId, byIp] = await Promise.all([failures(keys.identifierKey), failures(keys.ipKey)])
  return byId >= MAX_FAILURES_PER_IDENTIFIER || byIp >= MAX_FAILURES_PER_IP
}

export async function registerLoginFailure(keys: LoginRateKeys): Promise<void> {
  memAdd(keys.identifierKey)
  memAdd(keys.ipKey)
  await Promise.all([
    rpc('register_login_failure', { p_key: keys.identifierKey, p_window_seconds: WINDOW_SECONDS }),
    rpc('register_login_failure', { p_key: keys.ipKey, p_window_seconds: WINDOW_SECONDS }),
  ])
}

export async function clearLoginFailures(keys: LoginRateKeys): Promise<void> {
  memory.delete(keys.identifierKey)
  await rpc('clear_login_failures', { p_key: keys.identifierKey })
}
