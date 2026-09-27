import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CategoryManager } from '@/components/ajustes/CategoryManager'
import type { Category } from '@/types/database'

export const metadata: Metadata = {
  title: 'Ajustes · Finanzas',
  description: 'Gestiona tus categorías, cuentas y preferencias.',
}

export const dynamic = 'force-dynamic'

export default async function AjustesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Cargar categorías del usuario usando el cliente de SERVIDOR para que funcione RLS
  let categories: Category[] = []
  try {
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

    categories = roots.map((root) => ({
      ...root,
      subcategories: children.filter((c) => c.parent_id === root.id).sort((a, b) => a.sort_order - b.sort_order),
    }))
  } catch (err) {
    console.error('Error cargando categorías:', err)
  }

  return (
    <div className="min-h-full bg-zinc-950">
      <div className="px-5 pt-8 pb-6 max-w-md mx-auto space-y-6">

        {/* ── HEADER ──────────────────────────────────────── */}
        <header>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Settings2 size={20} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Ajustes</h1>
              <p className="text-xs text-zinc-500">Gestiona tus categorías</p>
            </div>
          </div>
        </header>

        {/* ── SECCIÓN CATEGORÍAS ──────────────────────────── */}
        <section aria-labelledby="section-categories">
          <div className="flex items-center justify-between mb-4">
            <h2 id="section-categories" className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
              Categorías
            </h2>
            <span className="text-xs text-zinc-600">
              {categories.length} en total
            </span>
          </div>

          <CategoryManager
            initialCategories={categories}
            userId={user.id}
          />
        </section>

      </div>
    </div>
  )
}
