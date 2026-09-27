'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIsAdmin } from '@/lib/auth/admin'
import { reportError, type ErrorCode } from '@/lib/errors'

type InviteUserResult = { ok: true } | { ok: false; code: ErrorCode }

// Invita por email (plantilla por defecto de Supabase). Nunca lanza.
export async function inviteUser(rawEmail: string): Promise<InviteUserResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !(await getIsAdmin(supabase, user.id))) {
      return { ok: false, code: 'AUTH-007' }
    }

    const email = rawEmail.trim().toLowerCase()
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return { ok: false, code: 'AUTH-010' }
    }

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/invitacion`,
    })

    if (error) {
      reportError('AUTH-011', error)
      return { ok: false, code: 'AUTH-011' }
    }

    return { ok: true }
  } catch (err: unknown) {
    reportError('AUTH-001', err)
    return { ok: false, code: 'AUTH-001' }
  }
}
