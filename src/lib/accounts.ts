import type { Account } from '@/types/database'

// ── Excluye una cuenta por id (nunca por nombre ni tipo) ─────
export function excludeAccount(accounts: Account[], excludedId?: string): Account[] {
  if (!excludedId) return accounts
  return accounts.filter((a) => a.id !== excludedId)
}

// ── Cuentas destino disponibles, agrupadas ───────────────────
// Excluye la cuenta origen y separa el resto en inversión (broker)
// y otras, conservando el orden original de `accounts`.
export function splitDestinationAccounts(
  accounts: Account[],
  sourceId?: string
): { investment: Account[]; other: Account[] } {
  const candidates = excludeAccount(accounts, sourceId)
  return {
    investment: candidates.filter((a) => a.type === 'broker'),
    other: candidates.filter((a) => a.type !== 'broker'),
  }
}
