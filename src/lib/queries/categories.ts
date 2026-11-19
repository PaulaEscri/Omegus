import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types/database'

// ── Obtener categorías con sus subcategorías (árbol completo) ─
export async function getCategoriesWithChildren(
  transactionType: string
): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, parent_id, name, transaction_type, is_cashback, is_investment, color, icon, sort_order, is_active')
    .eq('transaction_type', transactionType)
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error

  const all = (data ?? []) as Category[]
  const roots = all.filter((c) => c.parent_id === null)
  const children = all.filter((c) => c.parent_id !== null)

  return roots.map((root) => ({
    ...root,
    subcategories: children.filter((c) => c.parent_id === root.id),
  }))
}
