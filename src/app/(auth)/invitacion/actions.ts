'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportError, type ErrorCode } from '@/lib/errors'

interface AcceptInvitationInput {
  username: string
  password: string
}

type AcceptInvitationResult = { ok: true } | { ok: false; code: ErrorCode }

// Completa el registro de un usuario invitado: fija username + password.
// Nunca lanza.
export async function acceptInvitation(
  input: AcceptInvitationInput
): Promise<AcceptInvitationResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { ok: false, code: 'AUTH-005' }
    }

    const username = input.username.trim().toLowerCase()
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle()

    if (existing) {
      return { ok: false, code: 'AUTH-008' }
    }

    const { error: updateAuthError } = await supabase.auth.updateUser({
      password: input.password,
      data: { username },
    })

    if (updateAuthError) {
      reportError('AUTH-003', updateAuthError)
      return { ok: false, code: 'AUTH-003' }
    }

    // Actualiza profiles.username de su propia fila (lo permite RLS)
    const { error: updateProfileError } = await (supabase as any)
      .from('profiles')
      .update({ username })
      .eq('id', user.id)

    if (updateProfileError) {
      // Fallback: cliente admin filtrando por su propio id
      const { error: adminUpdateError } = await (adminClient as any)
        .from('profiles')
        .update({ username })
        .eq('id', user.id)

      if (adminUpdateError) {
        reportError('AUTH-003', adminUpdateError)
        return { ok: false, code: 'AUTH-003' }
      }
    }

    return { ok: true }
  } catch (err: unknown) {
    reportError('AUTH-001', err)
    return { ok: false, code: 'AUTH-001' }
  }
}
