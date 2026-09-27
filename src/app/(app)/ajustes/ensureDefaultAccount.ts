import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountType } from '@/types/database'

const DEFAULT_CASH_ACCOUNT = {
  name: 'Efectivo',
  type: 'cash' as AccountType,
  currency: 'EUR',
  color: '#f59e0b',
  icon: '💵',
}

// ── Garantiza que exista una cuenta "Efectivo" sin duplicarla ──
// Se ejecuta desde el Server Component de Ajustes antes de listar cuentas.
export async function ensureDefaultCashAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const db = supabase as any

  // ¿Ya hay una cuenta activa llamada "Efectivo" (sin distinguir mayúsculas)?
  const { data: active } = await db
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .ilike('name', DEFAULT_CASH_ACCOUNT.name)
    .maybeSingle()

  if (active) return

  // ¿Existe una desactivada? Reactivarla en vez de crear otra
  const { data: inactive } = await db
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', false)
    .ilike('name', DEFAULT_CASH_ACCOUNT.name)
    .maybeSingle()

  if (inactive) {
    await db.from('accounts').update({ is_active: true }).eq('id', inactive.id)
    return
  }

  await db.from('accounts').insert({
    ...DEFAULT_CASH_ACCOUNT,
    user_id: userId,
    sort_order: 0,
    is_active: true,
  })
}
