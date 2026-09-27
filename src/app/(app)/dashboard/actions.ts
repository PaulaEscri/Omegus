'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const TARGET_EMAIL = 'paulaescri04@gmail.com'

const MOCK_ACCOUNTS = [
  { name: 'Banco ING', type: 'bank', currency: 'EUR', color: '#10b981', icon: '🏦', sort_order: 1 },
  { name: 'Efectivo', type: 'cash', currency: 'EUR', color: '#f59e0b', icon: '💵', sort_order: 2 },
  { name: 'Trade Republic', type: 'broker', currency: 'EUR', color: '#3b82f6', icon: '📈', sort_order: 3 },
]

const MOCK_CATEGORIES = [
  { name: 'Nómina', transaction_type: 'income', color: '#10b981', icon: '💰', is_cashback: false, sort_order: 1 },
  { name: 'Freelance', transaction_type: 'income', color: '#8b5cf6', icon: '💻', is_cashback: false, sort_order: 2 },
  { name: 'Cashback', transaction_type: 'income', color: '#f59e0b', icon: '✨', is_cashback: true, sort_order: 3 },
  { name: 'Comida', transaction_type: 'expense', color: '#ef4444', icon: '🍽️', is_cashback: false, sort_order: 1 },
  { name: 'Ocio', transaction_type: 'expense', color: '#ec4899', icon: '🎮', is_cashback: false, sort_order: 2 },
  { name: 'Transporte', transaction_type: 'expense', color: '#f97316', icon: '🚗', is_cashback: false, sort_order: 3 },
  { name: 'Suscripciones', transaction_type: 'expense', color: '#6366f1', icon: '📱', is_cashback: false, sort_order: 4 },
  { name: 'Inversión', transaction_type: 'savings', color: '#3b82f6', icon: '📊', is_cashback: false, sort_order: 1 },
]

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function randomDateInMonth(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const day = Math.floor(Math.random() * daysInMonth) + 1
  return new Date(year, month, day).toISOString().split('T')[0]
}

export async function seedMockData(): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No autenticado' }

  if (user.email !== TARGET_EMAIL && process.env.NODE_ENV !== 'development') {
    return { ok: false, message: 'No autorizado para ejecutar el seed' }
  }

  // Usar cast as any para evitar que el tipo Database simplificado interfiera
  const db = supabase as any

  try {
    // ── 1. Insertar cuentas ───────────────────────────────────
    const accountsPayload = MOCK_ACCOUNTS.map((a) => ({ ...a, user_id: user.id, is_active: true }))
    await db.from('accounts').upsert(accountsPayload, { onConflict: 'user_id,name', ignoreDuplicates: true })

    const { data: accounts } = await db
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!accounts || accounts.length === 0) {
      return { ok: false, message: 'No se pudieron crear las cuentas. Revisa los permisos RLS.' }
    }

    // ── 2. Insertar categorías ────────────────────────────────
    const catsPayload = MOCK_CATEGORIES.map((c) => ({
      ...c, user_id: user.id, is_active: true, parent_id: null,
    }))
    await db.from('categories').upsert(catsPayload, { onConflict: 'user_id,name,transaction_type', ignoreDuplicates: true })

    const { data: categories } = await db
      .from('categories')
      .select('id, name, transaction_type, is_cashback')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('parent_id', null)

    if (!categories || categories.length === 0) {
      return { ok: false, message: 'No se pudieron crear las categorías.' }
    }

    // ── 3. Filtrar por tipos ──────────────────────────────────
    const liquidAccs = accounts.filter((a: any) => a.type !== 'broker')
    const brokerAccs = accounts.filter((a: any) => a.type === 'broker')
    const incomeCategories = categories.filter((c: any) => c.transaction_type === 'income' && !c.is_cashback)
    const cashbackCategories = categories.filter((c: any) => c.is_cashback)
    const expenseCategories = categories.filter((c: any) => c.transaction_type === 'expense')
    const savingsCategories = categories.filter((c: any) => c.transaction_type === 'savings')

    // ── 4. Generar transacciones ──────────────────────────────
    const today = new Date()
    const transactions: any[] = []

    for (let monthOffset = 3; monthOffset >= 0; monthOffset--) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth()

      // Nómina mensual fija
      if (incomeCategories.length > 0 && liquidAccs.length > 0) {
        transactions.push({
          user_id: user.id,
          type: 'income',
          amount: randomBetween(1800, 2400),
          currency: 'EUR',
          category_id: incomeCategories[0].id,
          subcategory_id: null,
          account_id: liquidAccs[0].id,
          destination_account_id: null,
          concept: 'Nómina mensual',
          notes: null,
          transaction_date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          is_recurring: true,
          tags: [],
        })
      }

      // Gastos aleatorios (10-16 por mes)
      const numExpenses = Math.floor(Math.random() * 7) + 10
      for (let i = 0; i < numExpenses; i++) {
        if (expenseCategories.length === 0 || liquidAccs.length === 0) break
        const cat = expenseCategories[Math.floor(Math.random() * expenseCategories.length)]
        const amounts: Record<string, [number, number]> = {
          Comida: [8, 80], Ocio: [10, 60], Transporte: [2, 40], Suscripciones: [5, 20],
        }
        const [min, max] = amounts[cat.name] ?? [5, 100]
        transactions.push({
          user_id: user.id,
          type: 'expense',
          amount: randomBetween(min, max),
          currency: 'EUR',
          category_id: cat.id,
          subcategory_id: null,
          account_id: liquidAccs[Math.floor(Math.random() * liquidAccs.length)].id,
          destination_account_id: null,
          concept: `${cat.name}`,
          notes: null,
          transaction_date: randomDateInMonth(year, month),
          is_recurring: false,
          tags: [],
        })
      }

      // Ahorro mensual
      if (savingsCategories.length > 0 && liquidAccs.length > 0 && brokerAccs.length > 0) {
        transactions.push({
          user_id: user.id,
          type: 'savings',
          amount: randomBetween(200, 600),
          currency: 'EUR',
          category_id: savingsCategories[0].id,
          subcategory_id: null,
          account_id: liquidAccs[0].id,
          destination_account_id: brokerAccs[0].id,
          concept: 'Transferencia a inversión',
          notes: null,
          transaction_date: randomDateInMonth(year, month),
          is_recurring: false,
          tags: [],
        })
      }

      // Cashback (1-2 por mes)
      if (cashbackCategories.length > 0 && liquidAccs.length > 0) {
        for (let i = 0; i < Math.floor(Math.random() * 2) + 1; i++) {
          transactions.push({
            user_id: user.id,
            type: 'income',
            amount: randomBetween(1, 25),
            currency: 'EUR',
            category_id: cashbackCategories[0].id,
            subcategory_id: null,
            account_id: liquidAccs[0].id,
            destination_account_id: null,
            concept: 'Cashback tarjeta',
            notes: null,
            transaction_date: randomDateInMonth(year, month),
            is_recurring: false,
            tags: [],
          })
        }
      }
    }

    // Insertar en lotes de 50
    for (let i = 0; i < transactions.length; i += 50) {
      const { error: txErr } = await db.from('transactions').insert(transactions.slice(i, i + 50))
      if (txErr) return { ok: false, message: `Error insertando transacciones: ${txErr.message}` }
    }

    revalidatePath('/dashboard')
    return {
      ok: true,
      message: `✅ Seed completado: ${accounts.length} cuentas, ${categories.length} categorías, ${transactions.length} transacciones generadas`,
    }
  } catch (err: any) {
    return { ok: false, message: err.message ?? 'Error desconocido en el seed' }
  }
}
