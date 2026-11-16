// ============================================================
// Sesión del usuario — SOLO SERVIDOR (layouts, páginas, route handlers)
// ============================================================
// Usa getClaims(): valida la firma del JWT en local (con las claves públicas
// JWKS de Supabase, cacheadas) en vez de hacer una ida y vuelta a Auth en cada
// request. Si el proyecto aún usa el secreto JWT legacy (HS256), Supabase hace
// internamente una llamada a Auth: sigue siendo correcto y seguro, solo que
// sin la mejora de latencia.
//
// `cache` de React deduplica la llamada dentro de un mismo render, así que
// layout + página comparten una sola verificación.
//
// Para ACCIONES que modifican datos o privilegios (server actions) sigue
// usándose supabase.auth.getUser(), que consulta al servidor de Auth.

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface SessionUser {
  id: string
  email: string | undefined
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined }
})
