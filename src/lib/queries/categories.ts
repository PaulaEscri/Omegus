import { createClient } from '@/lib/supabase/client'
import type { Category, TransactionType } from '@/types/database'

// ── Obtener categorías raíz por tipo ────────────────────────
export async function getCategories(transactionType?: string): Promise<Category[]> {
  const supabase = createClient()
  let query = supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order')

  if (transactionType) {
    query = query.eq('transaction_type', transactionType)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Category[]
}

// ── Obtener subcategorías de una categoría padre ─────────────
export async function getSubcategories(parentId: string): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return (data ?? []) as Category[]
}

// ── Obtener categorías con sus subcategorías (árbol completo) ─
export async function getCategoriesWithChildren(
  transactionType: string
): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
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

// ── Obtener TODAS las categorías raíz (todos los tipos) ───────
export async function getAllRootCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .order('transaction_type')
    .order('sort_order')

  if (error) throw error
  return (data ?? []) as Category[]
}

// ── Obtener TODAS las categorías con árbol (Ajustes) ──────────
export async function getAllCategoriesTree(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('transaction_type')
    .order('sort_order')

  if (error) throw error

  const all = (data ?? []) as Category[]
  const roots = all.filter((c) => c.parent_id === null)
  const children = all.filter((c) => c.parent_id !== null)

  return roots.map((root) => ({
    ...root,
    subcategories: children.filter((c) => c.parent_id === root.id).sort((a, b) => a.sort_order - b.sort_order),
  }))
}

// ── Añadir una nueva categoría ────────────────────────────────
export async function addCategory(input: {
  name: string
  transaction_type: TransactionType
  color: string
  icon: string
  is_cashback: boolean
  user_id: string
}): Promise<Category> {
  const supabase = createClient()

  // Obtener el siguiente sort_order para este tipo
  const { data: existing } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('transaction_type', input.transaction_type)
    .is('parent_id', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((existing as { sort_order: number } | null)?.sort_order ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('categories')
    .insert({
      name: input.name,
      transaction_type: input.transaction_type,
      color: input.color,
      icon: input.icon,
      is_cashback: input.is_cashback,
      user_id: input.user_id,
      sort_order: nextOrder,
      is_active: true,
      parent_id: null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Category
}

// ── Eliminar (desactivar) una categoría ───────────────────────
export async function deleteCategory(categoryId: string): Promise<void> {
  const supabase = createClient()
  // Soft-delete: desactivar en vez de borrar para no romper el historial
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('categories')
    .update({ is_active: false })
    .eq('id', categoryId)

  if (error) throw error
}
