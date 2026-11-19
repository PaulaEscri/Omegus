'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIsAdmin } from '@/lib/auth/admin'
import { reportError, type ErrorCode } from '@/lib/errors'

// Todas las acciones: validan en servidor que quien llama es admin
// (profiles.is_admin, única fuente de verdad) y usan el cliente service_role
// solo aquí. Nunca lanzan: devuelven { ok, code }.

type Result = { ok: true } | { ok: false; code: ErrorCode }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LEN = 254

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

async function requireAdmin(): Promise<
  { ok: true; selfId: string; admin: AnyClient } | { ok: false; code: ErrorCode }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await getIsAdmin(supabase, user.id))) {
    return { ok: false, code: 'AUTH-007' }
  }
  return { ok: true, selfId: user.id, admin: createAdminClient() as AnyClient }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length <= MAX_LEN ? v : null
}

function authCode(error: unknown, fallback: ErrorCode): ErrorCode {
  const code = (error as { code?: string })?.code
  if (code === 'weak_password') return 'AUTH-012'
  if (code === 'email_exists' || code === 'user_already_exists') return 'AUTH-010'
  return fallback
}

// ── CREATE ───────────────────────────────────────────────────
export async function adminCreateUser(input: {
  username: string
  email: string
  password: string
  isAdmin: boolean
}): Promise<Result> {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) return guard
    const { admin } = guard

    const rawUsername = str(input?.username)
    const rawEmail = str(input?.email)
    const password = typeof input?.password === 'string' ? input.password : ''
    if (rawUsername === null || rawEmail === null) return { ok: false, code: 'AUTH-004' }

    const username = rawUsername.trim().toLowerCase()
    const email = rawEmail.trim().toLowerCase()

    if (!username) return { ok: false, code: 'AUTH-004' }
    if (!EMAIL_RE.test(email)) return { ok: false, code: 'AUTH-016' }
    if (password.length < 6) return { ok: false, code: 'AUTH-012' }

    const { data: byName } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
    if (byName) return { ok: false, code: 'AUTH-008' }
    const { data: byEmail } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
    if (byEmail) return { ok: false, code: 'AUTH-010' }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    })
    if (error || !data?.user) {
      return { ok: false, code: authCode(error, 'AUTH-003') }
    }

    const isAdmin = input.isAdmin === true
    const id = data.user.id
    const { data: updated, error: upErr } = await admin
      .from('profiles')
      .update({ username, email, is_admin: isAdmin })
      .eq('id', id)
      .select('id')

    let saved = !upErr && Array.isArray(updated) && updated.length > 0
    if (!saved && !upErr) {
      const { error: insErr } = await admin
        .from('profiles')
        .insert({ id, email, username, is_admin: isAdmin })
      saved = !insErr
      if (insErr) reportError('AUTH-003', insErr)
    } else if (upErr) {
      reportError('AUTH-003', upErr)
    }

    if (!saved) {
      // Evita dejar una cuenta sin perfil
      await admin.auth.admin.deleteUser(id)
      return { ok: false, code: 'AUTH-003' }
    }

    revalidatePath('/admin')
    return { ok: true }
  } catch (err: unknown) {
    reportError('AUTH-001', err)
    return { ok: false, code: 'AUTH-001' }
  }
}

// ── UPDATE ───────────────────────────────────────────────────
export async function adminUpdateUser(input: {
  id: string
  username: string
  email: string
  isAdmin: boolean
  newPassword?: string
}): Promise<Result> {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) return guard
    const { admin, selfId } = guard

    const id = str(input?.id)
    if (!id || !UUID_RE.test(id)) return { ok: false, code: 'AUTH-014' }

    const rawUsername = str(input?.username)
    const rawEmail = str(input?.email)
    if (rawUsername === null || rawEmail === null) return { ok: false, code: 'AUTH-004' }

    const username = rawUsername.trim().toLowerCase()
    const email = rawEmail.trim().toLowerCase()
    const isAdmin = input.isAdmin === true
    const newPassword = typeof input.newPassword === 'string' ? input.newPassword : ''

    if (!username) return { ok: false, code: 'AUTH-004' }
    if (!EMAIL_RE.test(email)) return { ok: false, code: 'AUTH-016' }
    if (newPassword && newPassword.length < 6) return { ok: false, code: 'AUTH-012' }
    if (id === selfId && !isAdmin) return { ok: false, code: 'AUTH-015' }

    const { data: target } = await admin.from('profiles').select('id').eq('id', id).maybeSingle()
    if (!target) return { ok: false, code: 'AUTH-014' }

    const { data: byName } = await admin
      .from('profiles').select('id').eq('username', username).neq('id', id).maybeSingle()
    if (byName) return { ok: false, code: 'AUTH-008' }
    const { data: byEmail } = await admin
      .from('profiles').select('id').eq('email', email).neq('id', id).maybeSingle()
    if (byEmail) return { ok: false, code: 'AUTH-010' }

    const attrs: Record<string, unknown> = {
      email,
      email_confirm: true,
      user_metadata: { username },
    }
    if (newPassword) attrs.password = newPassword

    const { error: authErr } = await admin.auth.admin.updateUserById(id, attrs)
    if (authErr) {
      const code = authCode(authErr, 'AUTH-018')
      if (code === 'AUTH-018') reportError('AUTH-018', authErr)
      return { ok: false, code }
    }

    const { error: profErr } = await admin
      .from('profiles')
      .update({ username, email, is_admin: isAdmin })
      .eq('id', id)
    if (profErr) {
      reportError('AUTH-018', profErr)
      return { ok: false, code: 'AUTH-018' }
    }

    revalidatePath('/admin')
    return { ok: true }
  } catch (err: unknown) {
    reportError('AUTH-001', err)
    return { ok: false, code: 'AUTH-001' }
  }
}

// ── DELETE ───────────────────────────────────────────────────
// Tablas con datos del usuario, de hijas a padres, para limpiar si alguna FK
// hacia auth.users no tiene ON DELETE CASCADE.
const USER_TABLES = ['transactions', 'budgets', 'places', 'ai_usage', 'categories', 'accounts'] as const

export async function adminDeleteUser(id: string): Promise<Result> {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) return guard
    const { admin, selfId } = guard

    if (typeof id !== 'string' || !UUID_RE.test(id)) return { ok: false, code: 'AUTH-014' }
    if (id === selfId) return { ok: false, code: 'AUTH-015' }

    const { data: target } = await admin.from('profiles').select('id').eq('id', id).maybeSingle()
    if (!target) return { ok: false, code: 'AUTH-014' }

    let { error } = await admin.auth.admin.deleteUser(id)

    if (error) {
      // Posible FK sin cascade: limpiamos los datos del usuario y reintentamos
      reportError('AUTH-017', error)
      for (const table of USER_TABLES) {
        const { error: delErr } = await admin.from(table).delete().eq('user_id', id)
        if (delErr) reportError('AUTH-017', { table, delErr })
      }
      await admin.from('profiles').delete().eq('id', id)
      ;({ error } = await admin.auth.admin.deleteUser(id))
      if (error) {
        reportError('AUTH-017', error)
        return { ok: false, code: 'AUTH-017' }
      }
    }

    // Sin huérfanos: si no hubo cascade, quita lo que quede
    await admin.from('profiles').delete().eq('id', id)
    for (const table of USER_TABLES) {
      await admin.from(table).delete().eq('user_id', id)
    }

    revalidatePath('/admin')
    return { ok: true }
  } catch (err: unknown) {
    reportError('AUTH-001', err)
    return { ok: false, code: 'AUTH-001' }
  }
}

