'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TransactionType } from '@/types/database'

// ── Añadir categoría ──────────────────────────────────────────
export async function actionAddCategory(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const name = (formData.get('name') as string).trim()
  const transaction_type = formData.get('transaction_type') as TransactionType
  const color = formData.get('color') as string
  const icon = formData.get('icon') as string
  const is_cashback = formData.get('is_cashback') === 'true'
  const is_investment = transaction_type === 'savings' && formData.get('is_investment') === 'true'
  const parent_id = formData.get('parent_id') as string | null

  if (!name || !transaction_type) throw new Error('Nombre y tipo son obligatorios')

  // Evitar duplicados: misma categoría (user_id + nombre, sin distinguir mayúsculas) en el mismo tipo y nivel
  let dupQuery = (supabase as any)
    .from('categories')
    .select('id')
    .eq('user_id', user.id)
    .eq('transaction_type', transaction_type)
    .eq('is_active', true)
    .ilike('name', name)
  dupQuery = parent_id ? dupQuery.eq('parent_id', parent_id) : dupQuery.is('parent_id', null)

  const { data: duplicate } = await dupQuery.maybeSingle()
  if (duplicate) throw new Error(`Ya existe una categoría llamada "${name}" en este tipo`)

  // Siguiente sort_order
  const { data: existing } = await (supabase as any)
    .from('categories')
    .select('sort_order')
    .eq('transaction_type', transaction_type)
    .is('parent_id', parent_id ?? null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (existing?.sort_order ?? 0) + 1

  const { error } = await (supabase as any).from('categories').insert({
    name,
    transaction_type,
    color,
    icon,
    is_cashback,
    is_investment,
    user_id: user.id,
    sort_order: nextOrder,
    is_active: true,
    parent_id: parent_id ?? null,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/ajustes')
  revalidatePath('/registro')
}

// ── Editar categoría ──────────────────────────────────────────
export async function actionUpdateCategory(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const name = (formData.get('name') as string).trim()
  const transaction_type = formData.get('transaction_type') as TransactionType
  const color = formData.get('color') as string
  const icon = formData.get('icon') as string
  const is_cashback = formData.get('is_cashback') === 'true'
  const is_investment = transaction_type === 'savings' && formData.get('is_investment') === 'true'
  const parent_id = formData.get('parent_id') as string | null

  if (!name || !transaction_type) throw new Error('Nombre y tipo son obligatorios')

  // Evitar duplicados con otra categoría existente (excluyendo la que se está editando)
  let dupQuery = (supabase as any)
    .from('categories')
    .select('id')
    .eq('user_id', user.id)
    .eq('transaction_type', transaction_type)
    .eq('is_active', true)
    .ilike('name', name)
    .neq('id', id)
  dupQuery = parent_id ? dupQuery.eq('parent_id', parent_id) : dupQuery.is('parent_id', null)

  const { data: duplicate } = await dupQuery.maybeSingle()
  if (duplicate) throw new Error(`Ya existe una categoría llamada "${name}" en este tipo`)

  const { error } = await (supabase as any)
    .from('categories')
    .update({
      name,
      transaction_type,
      color,
      icon,
      is_cashback,
      is_investment,
      parent_id: parent_id ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/ajustes')
  revalidatePath('/registro')
}

// ── Eliminar (soft-delete) categoría ─────────────────────────
export async function actionDeleteCategory(categoryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await (supabase as any)
    .from('categories')
    .update({ is_active: false })
    .eq('id', categoryId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/ajustes')
  revalidatePath('/registro')
}
