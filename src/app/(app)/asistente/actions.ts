'use server'

import { createClient } from '@/lib/supabase/server'
import { verifyAction } from '@/lib/ai/actionToken'
import { executeAction, type Db } from '@/lib/ai/domain'

type ConfirmResult = { ok: boolean; message: string }

// Ejecuta una acción propuesta por la IA tras pulsar "Confirmar".
// Verifica el token firmado (usuario, caducidad, contenido) y ejecuta con la
// sesión del usuario (RLS). Nunca lanza: Next oculta los mensajes lanzados en
// producción, así que el resultado siempre viaja como { ok, message }.
export async function confirmAiAction(token: string): Promise<ConfirmResult> {
  try {
    if (typeof token !== 'string' || token.length > 4000) return { ok: false, message: 'Acción no válida' }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser() // verificación real en servidor para escrituras
    if (!user) return { ok: false, message: 'Sesión caducada' }

    const payload = await verifyAction(token, user.id)
    if (!payload) return { ok: false, message: 'La propuesta ha caducado. Pídemelo de nuevo.' }

    return await executeAction(supabase as unknown as Db, user.id, payload)
  } catch (err) {
    console.error('[ai] confirmAiAction:', err)
    return { ok: false, message: 'No se pudo completar la acción' }
  }
}
