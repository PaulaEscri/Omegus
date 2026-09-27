'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isProtectedAccount } from '@/lib/protectedEntities'
import type { AccountType } from '@/types/database'

// ── Añadir cuenta ─────────────────────────────────────────────
export async function actionAddAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const name = (formData.get('name') as string).trim()
  const type = formData.get('type') as AccountType
  const color = formData.get('color') as string
  const icon = formData.get('icon') as string

  if (!name || !type) throw new Error('Nombre y tipo son obligatorios')

  const db = supabase as any

  // Evitar duplicados: misma cuenta (user_id + nombre) ya activa
  const { data: duplicate } = await db
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .ilike('name', name)
    .maybeSingle()

  if (duplicate) throw new Error(`Ya existe una cuenta llamada "${name}"`)

  const { data: existing } = await db
    .from('accounts')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (existing?.sort_order ?? 0) + 1

  const { error } = await db.from('accounts').insert({
    name,
    type,
    color,
    icon,
    currency: 'EUR',
    user_id: user.id,
    sort_order: nextOrder,
    is_active: true,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/ajustes')
  revalidatePath('/dashboard')
  revalidatePath('/registro')
}

// ── Editar cuenta ─────────────────────────────────────────────
export async function actionUpdateAccount(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const name = (formData.get('name') as string).trim()
  const type = formData.get('type') as AccountType
  const color = formData.get('color') as string
  const icon = formData.get('icon') as string

  if (!name || !type) throw new Error('Nombre y tipo son obligatorios')

  const db = supabase as any

  // Evitar duplicados con otra cuenta existente (excluyendo la que se está editando)
  const { data: duplicate } = await db
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .ilike('name', name)
    .neq('id', id)
    .maybeSingle()

  if (duplicate) throw new Error(`Ya existe una cuenta llamada "${name}"`)

  const { error } = await db
    .from('accounts')
    .update({ name, type, color, icon })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/ajustes')
  revalidatePath('/dashboard')
  revalidatePath('/registro')
}

// ── Eliminar (soft-delete) cuenta ─────────────────────────────
export async function actionDeleteAccount(accountId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const db = supabase as any

  const { data: account } = await db
    .from('accounts')
    .select('name, type')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (account && isProtectedAccount(account)) {
    throw new Error('Esta cuenta es del sistema y no se puede eliminar')
  }

  const { error } = await db
    .from('accounts')
    .update({ is_active: false })
    .eq('id', accountId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/ajustes')
  revalidatePath('/dashboard')
  revalidatePath('/registro')
}
