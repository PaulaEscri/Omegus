import type { SupabaseClient } from '@supabase/supabase-js'

// Lee profiles.is_admin del usuario indicado. Devuelve false si no hay fila
// o si la consulta falla (nunca lanza) — el llamador decide qué hacer.
export async function getIsAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return false
  return data.is_admin === true
}
