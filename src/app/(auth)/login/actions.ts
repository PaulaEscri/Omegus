'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportError, type ErrorCode } from '@/lib/errors'
import {
  buildLoginKeys,
  isLoginBlocked,
  registerLoginFailure,
  clearLoginFailures,
} from '@/lib/auth/rateLimit'

interface LoginInput {
  identifier: string
  password: string
}

type LoginResult = { ok: true } | { ok: false; code: ErrorCode }

const MAX_IDENTIFIER_LENGTH = 254
const MAX_PASSWORD_LENGTH = 256

// Escapa los comodines de LIKE/ILIKE para que el input se trate como texto literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Resuelve usuario → email EN SERVIDOR. El email nunca viaja al navegador.
// Devuelve null si no se resuelve (el login se intenta igualmente con el input
// original para que la respuesta sea idéntica exista o no el usuario).
async function resolveEmail(identifier: string): Promise<string | null> {
  // Cast como en signup/actions.ts: el tipo Database simplificado infiere `never` en profiles.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 1º: username exacto
  const { data: byUsername } = await admin
    .from('profiles')
    .select('email')
    .eq('username', identifier)
    .maybeSingle()
  if (byUsername?.email) return byUsername.email as string

  // 2º (compatibilidad): prefijo de email, solo si es único
  const { data: byPrefix } = await admin
    .from('profiles')
    .select('email')
    .ilike('email', `${escapeLike(identifier)}@%`)
    .limit(2)
  if (byPrefix && byPrefix.length === 1) return byPrefix[0].email as string

  return null
}

// Inicia sesión con email o nombre de usuario. Nunca lanza: Next oculta los
// mensajes de error lanzados en producción, así que el resultado siempre
// viaja como { ok, code } explícito.
export async function signInWithIdentifier(input: LoginInput): Promise<LoginResult> {
  try {
    if (
      typeof input?.identifier !== 'string' ||
      typeof input?.password !== 'string' ||
      !input.identifier.trim() ||
      !input.password ||
      input.identifier.length > MAX_IDENTIFIER_LENGTH ||
      input.password.length > MAX_PASSWORD_LENGTH
    ) {
      return { ok: false, code: 'AUTH-002' }
    }

    const cleanInput = input.identifier.trim().toLowerCase()
    const keys = await buildLoginKeys(cleanInput)

    if (await isLoginBlocked(keys)) {
      return { ok: false, code: 'AUTH-013' }
    }

    const targetEmail = cleanInput.includes('@')
      ? cleanInput
      : ((await resolveEmail(cleanInput)) ?? cleanInput)

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: input.password,
    })

    if (error) {
      reportError('AUTH-002', error)
      await registerLoginFailure(keys)
      return { ok: false, code: 'AUTH-002' }
    }

    await clearLoginFailures(keys)
    return { ok: true }
  } catch (err: unknown) {
    reportError('AUTH-001', err)
    return { ok: false, code: 'AUTH-001' }
  }
}
