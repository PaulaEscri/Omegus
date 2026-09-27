'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function injectDefinitiveStructure() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const db = supabase as any

  try {
    // ── 1. Cuentas ──────────────────────────────────────────────
    const accounts = [
      { user_id: user.id, name: 'BBVA', type: 'bank', currency: 'EUR', color: '#0f3f87', icon: '🏦', sort_order: 1, is_active: true },
      { user_id: user.id, name: 'Revolut', type: 'digital', currency: 'EUR', color: '#000000', icon: '💳', sort_order: 2, is_active: true },
      { user_id: user.id, name: 'Trade Republic', type: 'broker', currency: 'EUR', color: '#3b82f6', icon: '📈', sort_order: 3, is_active: true },
    ]
    for (const acc of accounts) {
      // Verificar si ya existe para no duplicar (ya que upsert falla sin constraint)
      const { data: existing } = await db.from('accounts').select('id').eq('user_id', user.id).eq('name', acc.name).maybeSingle()
      if (!existing) {
        await db.from('accounts').insert(acc)
      }
    }

    // ── 2. Categorías Padre ─────────────────────────────────────
    const rootCategories = [
      // Ingresos
      { name: 'Nómina', type: 'income', color: '#10b981', icon: '💼', cashback: false },
      { name: 'Attara Studio', type: 'income', color: '#8b5cf6', icon: '🎨', cashback: false },
      { name: 'Cashback e Intereses', type: 'income', color: '#f59e0b', icon: '✨', cashback: true },
      { name: 'Otros Ingresos', type: 'income', color: '#6b7280', icon: '➕', cashback: false },
      
      // Ahorros
      { name: 'Fondo de Seguridad', type: 'savings', color: '#3b82f6', icon: '🛡️', cashback: false },
      { name: 'Acciones', type: 'savings', color: '#6366f1', icon: '📈', cashback: false },
      { name: 'Bonos', type: 'savings', color: '#14b8a6', icon: '📜', cashback: false },
      { name: 'Criptomonedas', type: 'savings', color: '#f59e0b', icon: '₿', cashback: false },
      
      // Gastos
      { name: 'Comida', type: 'expense', color: '#ef4444', icon: '🍽️', cashback: false },
      { name: 'Transporte', type: 'expense', color: '#f97316', icon: '🚗', cashback: false },
      { name: 'Suscripciones', type: 'expense', color: '#8b5cf6', icon: '📱', cashback: false },
      { name: 'Ocio y Vida', type: 'expense', color: '#ec4899', icon: '🎉', cashback: false },
      { name: 'Otros Gastos', type: 'expense', color: '#6b7280', icon: '➖', cashback: false },
    ]

    const createdRoots: Record<string, string> = {} // name -> id
    
    let orderIndex = 1
    for (const cat of rootCategories) {
      const { data: existing } = await db.from('categories')
        .select('id').eq('user_id', user.id).eq('name', cat.name).eq('transaction_type', cat.type).is('parent_id', null).maybeSingle()
      
      if (existing) {
        createdRoots[cat.name] = existing.id
      } else {
        const { data } = await db.from('categories').insert({
          user_id: user.id,
          name: cat.name,
          transaction_type: cat.type,
          color: cat.color,
          icon: cat.icon,
          is_cashback: cat.cashback,
          sort_order: orderIndex++,
          is_active: true,
          parent_id: null
        }).select().single()
        if (data) createdRoots[cat.name] = data.id
      }
    }

    // ── 3. Subcategorías ────────────────────────────────────────
    const subcategories = [
      { parent: 'Comida', name: 'Supermercado', type: 'expense', color: '#ef4444', icon: '🛒' },
      { parent: 'Comida', name: 'Restaurantes', type: 'expense', color: '#ef4444', icon: '🍕' },
      { parent: 'Comida', name: 'Cerveza', type: 'expense', color: '#ef4444', icon: '🍺' },
      
      { parent: 'Transporte', name: 'Autoescuela y Tasas', type: 'expense', color: '#f97316', icon: '🚙' },
      { parent: 'Transporte', name: 'Gasolina', type: 'expense', color: '#f97316', icon: '⛽' },
      { parent: 'Transporte', name: 'Transporte Público/Taxis', type: 'expense', color: '#f97316', icon: '🚌' },
      
      { parent: 'Suscripciones', name: 'Digitales', type: 'expense', color: '#8b5cf6', icon: '💻' },
      
      { parent: 'Ocio y Vida', name: 'Salidas', type: 'expense', color: '#ec4899', icon: '💃' },
      { parent: 'Ocio y Vida', name: 'Compras', type: 'expense', color: '#ec4899', icon: '🛍️' },
      { parent: 'Ocio y Vida', name: 'Regalos', type: 'expense', color: '#ec4899', icon: '🎁' },
    ]

    orderIndex = 1
    for (const sub of subcategories) {
      const parentId = createdRoots[sub.parent]
      if (!parentId) continue // si falló la creación del padre
      
      const { data: existing } = await db.from('categories')
        .select('id').eq('user_id', user.id).eq('name', sub.name).eq('parent_id', parentId).maybeSingle()
        
      if (!existing) {
        await db.from('categories').insert({
          user_id: user.id,
          name: sub.name,
          transaction_type: sub.type,
          color: sub.color,
          icon: sub.icon,
          is_cashback: false,
          sort_order: orderIndex++,
          is_active: true,
          parent_id: parentId
        })
      }
    }

    revalidatePath('/ajustes')
    return { ok: true, message: '¡Estructura inyectada con éxito!' }
  } catch (err: any) {
    return { ok: false, message: err.message ?? 'Error inyectando estructura' }
  }
}
