import { createClient } from '@/lib/supabase/client'
import type { Transaction } from '@/types/database'
import type { TransactionSchema } from '@/lib/validations/transaction.schema'
import { format } from 'date-fns'

// ── Insertar una transacción ────────────────────────────────
export async function createTransaction(
  formData: TransactionSchema,
  userId: string
): Promise<Transaction> {
  const supabase = createClient()

  const payload = {
    user_id: userId,
    type: formData.type,
    amount: formData.amount,
    currency: formData.currency,
    category_id: formData.category_id,
    subcategory_id: formData.subcategory_id || null,
    account_id: formData.account_id,
    destination_account_id: formData.destination_account_id || null,
    concept: formData.concept,
    notes: formData.notes || null,
    transaction_date: format(formData.transaction_date, 'yyyy-MM-dd'),
    is_recurring: formData.is_recurring,
    tags: formData.tags ?? [],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('transactions') as any)
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return data as Transaction
}

// ── Obtener transacciones con filtros ───────────────────────
export async function getTransactions(params: {
  type?: 'income' | 'expense' | 'savings'
  dateFrom?: string
  dateTo?: string
  categoryId?: string
  accountId?: string
  limit?: number
  offset?: number
}): Promise<{ data: Transaction[]; count: number }> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('transactions') as any)
    .select(
      `
      *,
      category:categories!category_id(id, name, color, icon, is_cashback),
      subcategory:categories!subcategory_id(id, name, color, icon),
      account:accounts!account_id(id, name, color, icon, type),
      destination_account:accounts!destination_account_id(id, name, color, icon, type)
    `,
      { count: 'exact' }
    )
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (params.type) query = query.eq('type', params.type)
  if (params.dateFrom) query = query.gte('transaction_date', params.dateFrom)
  if (params.dateTo) query = query.lte('transaction_date', params.dateTo)
  if (params.categoryId) query = query.eq('category_id', params.categoryId)
  if (params.accountId) query = query.eq('account_id', params.accountId)
  if (params.limit) query = query.limit(params.limit)
  if (params.offset) {
    query = query.range(params.offset, (params.offset + (params.limit ?? 20)) - 1)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data as Transaction[]) ?? [], count: (count as number) ?? 0 }
}

// ── Actualizar una transacción ──────────────────────────────
export async function updateTransaction(
  id: string,
  formData: Partial<TransactionSchema>
): Promise<Transaction> {
  const supabase = createClient()

  const updatePayload: Record<string, unknown> = { ...formData }
  if (formData.transaction_date) {
    updatePayload.transaction_date = format(formData.transaction_date, 'yyyy-MM-dd')
  }
  // Limpiar el campo Date original si quedó
  delete updatePayload.transaction_date

  if (formData.transaction_date) {
    updatePayload.transaction_date = format(formData.transaction_date, 'yyyy-MM-dd')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('transactions') as any)
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as Transaction
}

// ── Eliminar una transacción ────────────────────────────────
export async function deleteTransaction(id: string): Promise<void> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('transactions') as any).delete().eq('id', id)
  if (error) throw error
}
