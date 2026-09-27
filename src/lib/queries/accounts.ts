import { createClient } from '@/lib/supabase/client'
import type { Account, AccountBalance } from '@/types/database'

// ── Obtener cuentas activas del usuario ──────────────────────
export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return data ?? []
}

// ── Obtener saldos calculados de todas las cuentas ───────────
export async function getAccountBalances(): Promise<AccountBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('v_account_balance')
    .select('*')
    .order('type')

  if (error) throw error
  return data ?? []
}
