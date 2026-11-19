// SOLO SERVIDOR. Comprobaciones comunes de las rutas /api/bank/*.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isBankingConfigured } from './enableBanking'

export const bankJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export function siteUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  return base ? `${base}${path}` : null
}

export interface BankAuth {
  userId: string
  db: SupabaseClient
}

// Sesión real (getUser) + defensa CSRF (Origin = host) en peticiones que escriben.
export async function requireBankUser(
  req: Request,
  opts: { write?: boolean } = {}
): Promise<BankAuth | Response> {
  if (opts.write) {
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) return bankJson({ error: 'forbidden' }, 403)
      } catch {
        return bankJson({ error: 'forbidden' }, 403)
      }
    }
  }

  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return bankJson({ error: 'Sesión caducada. Recarga la página.' }, 401)

  if (!isBankingConfigured()) {
    return bankJson(
      { error: 'La conexión bancaria no está configurada (faltan ENABLE_BANKING_APP_ID o ENABLE_BANKING_PRIVATE_KEY).' },
      503
    )
  }
  return { userId: user.id, db: db as unknown as SupabaseClient }
}
