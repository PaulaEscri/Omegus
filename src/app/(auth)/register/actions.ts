'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportError, type ErrorCode } from '@/lib/errors'

interface RegisterInput {
  username: string
  email: string
  password: string
}

type RegisterResult = { ok: true } | { ok: false; code: ErrorCode }

// Registro público (ruta oculta /register). Misma normalización y comprobación
// de duplicados que createUserAsAdmin: username en minúsculas, único en profiles
// y guardado en user_metadata + profiles.username. Nunca lanza.
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  try {
    const username = input.username.trim().toLowerCase()
    const email = input.email.trim().toLowerCase()

    if (!username) return { ok: false, code: 'AUTH-004' }
    if (input.password.length < 6) return { ok: false, code: 'AUTH-012' }

    const adminClient = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (adminClient as any)
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) return { ok: false, code: 'AUTH-008' }

    // signUp con el cliente de servidor: deja la sesión en las cookies
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: { data: { username } },
    })

    if (error) {
      const code = (error as { code?: string }).code
      if (code === 'user_already_exists') return { ok: false, code: 'AUTH-010' }
      if (code === 'weak_password') return { ok: false, code: 'AUTH-012' }
      reportError('AUTH-003', error)
      return { ok: false, code: 'AUTH-003' }
    }

    // Sin sesión = confirmación por correo activada: no se puede entrar directo
    if (!data.user || !data.session) {
      reportError('AUTH-003', 'signUp sin sesión')
      return { ok: false, code: 'AUTH-003' }
    }

    // Garantiza profiles.username (trazabilidad) aunque el trigger de alta no lo
    // copie del metadata; si la fila de perfil no existe todavía, la crea.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profiles = (adminClient as any).from('profiles')
    const { data: updated, error: updateError } = await profiles
      .update({ username })
      .eq('id', data.user.id)
      .select('id')

    let saved = !updateError && Array.isArray(updated) && updated.length > 0
    if (!saved && !updateError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (adminClient as any)
        .from('profiles')
        .insert({ id: data.user.id, email, username })
      saved = !insertError
      if (insertError) reportError('AUTH-003', insertError)
    } else if (updateError) {
      reportError('AUTH-003', updateError)
    }

    if (!saved) return { ok: false, code: 'AUTH-003' }

    return { ok: true }
  } catch (err: unknown) {
    reportError('AUTH-001', err)
    return { ok: false, code: 'AUTH-001' }
  }
}
