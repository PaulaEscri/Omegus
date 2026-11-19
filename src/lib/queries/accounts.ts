import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/types/database'

// ── Obtener cuentas activas del usuario ──────────────────────
export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, type, currency, color, icon, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return (data ?? []) as Account[]
}
