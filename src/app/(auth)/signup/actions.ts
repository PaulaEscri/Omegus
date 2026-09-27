'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIsAdmin } from '@/lib/auth/admin'
import { reportError, type ErrorCode } from '@/lib/errors'

interface CreateUserInput {
  username: string
  email: string
  password: string
}

type CreateUserResult = { ok: true } | { ok: false; code: ErrorCode }

// Crea un usuario desde el servidor con la Service Role Key, para que la
// sesión del admin que la invoca nunca se vea afectada. Nunca lanza: Next
// oculta los mensajes de error lanzados en producción, así que el resultado
// siempre viaja como { ok, code } explícito.
export async function createUserAsAdmin(input: CreateUserInput): Promise<CreateUserResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !(await getIsAdmin(supabase, user.id))) {
      return { ok: false, code: 'AUTH-007' }
    }

    const username = input.username.trim().toLowerCase()
    const email = input.email.trim().toLowerCase()

    if (!username) {
      return { ok: false, code: 'AUTH-004' }
    }

    const adminClient = createAdminClient()

    const { data: existing } = await (adminClient as any)
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) {
      return { ok: false, code: 'AUTH-008' }
    }

    const { error } = await adminClient.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { username },
    })

    if (error) {
      reportError('AUTH-003', error)
      return { ok: false, code: 'AUTH-003' }
    }

    return { ok: true }
  } catch (err: unknown) {
    reportError('AUTH-001', err)
    return { ok: false, code: 'AUTH-001' }
  }
}
