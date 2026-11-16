/* eslint-disable @typescript-eslint/no-explicit-any */
// SOLO SERVIDOR. Cuota diaria de peticiones al asistente por usuario.
// Lee el uso con la sesión del usuario (RLS) y lo incrementa con la función
// register_ai_usage, ejecutable solo por service_role (el usuario no puede
// resetearse la cuota). Si la tabla aún no existe, NO bloquea (falla abierto).

import { createAdminClient } from '@/lib/supabase/admin'
import { getDailyLimit } from './config'
import type { Db } from './domain'

export async function checkAndCountUsage(
  db: Db,
  userId: string
): Promise<{ allowed: boolean; limit: number }> {
  const limit = getDailyLimit()
  const day = new Date().toISOString().slice(0, 10) // la columna day usa current_date (UTC)

  const { data, error } = await db.from('ai_usage').select('requests').eq('day', day).maybeSingle()
  if (error) {
    console.error('[ai] usage read:', error.message)
    return { allowed: true, limit } // tabla no disponible: no bloquear
  }
  if (((data as any)?.requests ?? 0) >= limit) return { allowed: false, limit }

  try {
    const { error: rpcErr } = await (createAdminClient() as any).rpc('register_ai_usage', {
      p_user_id: userId,
      p_tokens_in: 0,
      p_tokens_out: 0,
    })
    if (rpcErr) console.error('[ai] usage register:', rpcErr.message)
  } catch (e) {
    console.error('[ai] usage register:', e)
  }
  return { allowed: true, limit }
}
