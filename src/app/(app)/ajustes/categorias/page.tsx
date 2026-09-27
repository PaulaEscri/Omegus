import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Shapes } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CategoryManager } from '@/components/ajustes/CategoryManager'
import type { Category } from '@/types/database'

export const metadata: Metadata = {
  title: 'Categorías · Ajustes',
  description: 'Gestiona tus categorías de ingresos, gastos y ahorro.',
}

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
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
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 px-5 py-4">
        <div className="flex items-center gap-3.5 max-w-md mx-auto">
          <Link
            href="/ajustes"
            id="btn-back-categorias"
            aria-label="Volver a Ajustes"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all active:scale-95 shrink-0"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
              <Shapes size={16} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-50">Categorías</h1>
              <p className="text-xs font-medium text-zinc-500">{categories.length} en total</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 pt-6 pb-8 max-w-md mx-auto">
        <CategoryManager
          initialCategories={categories}
          userId={user.id}
        />
      </div>
    </div>
  )
}
