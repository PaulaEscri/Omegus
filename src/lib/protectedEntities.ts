import type { Account } from '@/types/database'

// ── Cuentas del sistema ───────────────────────────────────────
// La cuenta "Efectivo" es el destino por defecto garantizado por
// ensureDefaultCashAccount y no puede eliminarse desde la interfaz.
export function isProtectedAccount(account: Pick<Account, 'name' | 'type'>): boolean {
  return account.type === 'cash' && account.name.trim().toLowerCase() === 'efectivo'
}
