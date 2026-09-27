'use client'

import { useState, useTransition } from 'react'
import { Trash2, Plus, Loader2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Edit3, CornerDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { actionAddCategory, actionDeleteCategory, actionUpdateCategory } from '@/app/(app)/ajustes/actions'
import type { Category, TransactionType } from '@/types/database'

const COLOR_PALETTE = [
  '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#a855f7', '#06b6d4', '#eab308', '#64748b', '#d946ef',
]

const ICON_OPTIONS = [
  '💰', '🏦', '💳', '🛒', '🍽️', '🚗', '🚙', '⛽', '🚌', '🏠',
  '🏥', '📱', '💻', '✈️', '🎮', '💃', '🛍️', '🎁', '👗', '💊',
  '📚', '🎵', '⚽', '🌱', '💼', '🎨', '➕', '➖', '🛡️', '📜',
  '₿', '🔧', '☕', '🍺', '🍕', '🎬', '🐾', '🏋️', '💡', '📊',
]

type Props = {
  initialCategories: Category[]
  userId: string
}

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Ingresos',
  expense: 'Gastos',
  savings: 'Ahorros / Inversiones',
}

const TYPE_COLORS: Record<TransactionType, string> = {
  income: 'text-emerald-400',
  expense: 'text-red-400',
  savings: 'text-blue-400',
}

const TYPE_BG: Record<TransactionType, string> = {
  income: 'bg-emerald-500/10 border-emerald-500/30',
  expense: 'bg-red-500/10 border-red-500/30',
  savings: 'bg-blue-500/10 border-blue-500/30',
}

type FormState = {
  mode: 'add_root' | 'add_sub' | 'edit'
  categoryId?: string
  parentId?: string
  defaultType?: TransactionType
}

export function CategoryManager({ initialCategories, userId }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [expanded, setExpanded] = useState<TransactionType | null>('expense')
  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>({})

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Form State
  const [formState, setFormState] = useState<FormState | null>(null)
  const [formType, setFormType] = useState<TransactionType>('expense')
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState(COLOR_PALETTE[0])
  const [formIcon, setFormIcon] = useState(ICON_OPTIONS[0])
  const [formIsCashback, setFormIsCashback] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)
  
  const [isPending, startTransition] = useTransition()

  // Agrupar categorías raíz
  const groupedCategories = (['income', 'expense', 'savings'] as TransactionType[]).reduce(
    (acc, type) => {
      acc[type] = categories.filter((c) => c.transaction_type === type && c.is_active && c.parent_id === null)
      return acc
    },
    {} as Record<TransactionType, Category[]>
  )

  const toggleRoot = (id: string) => {
    setExpandedRoots((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const openForm = (state: FormState, cat?: Category) => {
    setFormState(state)
    setFormError('')
    setFormSuccess(false)
    if (state.mode === 'edit' && cat) {
      setFormType(cat.transaction_type)
      setFormName(cat.name)
      setFormColor(cat.color)
      setFormIcon(cat.icon)
      setFormIsCashback(cat.is_cashback)
    } else {
      setFormType(state.defaultType ?? 'expense')
      setFormName('')
      setFormColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)])
      setFormIcon(ICON_OPTIONS[0])
      setFormIsCashback(false)
    }
    
    // Scroll al formulario (al final de la página o donde esté montado)
    setTimeout(() => {
      document.getElementById('category-form-container')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleDelete = (cat: Category) => {
    if (confirmDeleteId !== cat.id) {
      setConfirmDeleteId(cat.id)
      return
    }
    setDeletingId(cat.id)
    setConfirmDeleteId(null)
    startTransition(async () => {
      try {
        await actionDeleteCategory(cat.id)
        // Eliminar del estado local (si es root, también quitamos sus subs)
        setCategories((prev) => {
          if (cat.parent_id === null) {
            return prev.filter((c) => c.id !== cat.id) // Las subs van dentro del root en el estado actual, wait.
          } else {
            // Es subcategoría, encontrar al padre y filtrarla
            return prev.map(p => {
              if (p.id === cat.parent_id && p.subcategories) {
                return { ...p, subcategories: p.subcategories.filter(s => s.id !== cat.id) }
              }
              return p
            })
          }
        })
        
        // Si era root, simplemente filtrar (aunque el API devuelve un array de roots, el delete también aplica a roots)
        setCategories((prev) => prev.filter(c => c.id !== cat.id))

      } catch (err) {
        console.error(err)
      } finally {
        setDeletingId(null)
      }
    })
  }

  const handleSubmit = () => {
    if (!formName.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    if (!formState) return

    setFormError('')
    const fd = new FormData()
    fd.set('name', formName.trim())
    fd.set('transaction_type', formType)
    fd.set('color', formColor)
    fd.set('icon', formIcon)
    fd.set('is_cashback', String(formIsCashback))
    
    if (formState.parentId) fd.set('parent_id', formState.parentId)

    startTransition(async () => {
      try {
        if (formState.mode === 'edit' && formState.categoryId) {
          // Si editamos subcategoria, necesitamos pasar parent_id también si lo tenía
          const originalCat = categories.flatMap(c => [c, ...(c.subcategories || [])]).find(c => c.id === formState.categoryId)
          if (originalCat?.parent_id) fd.set('parent_id', originalCat.parent_id)
            
          await actionUpdateCategory(formState.categoryId, fd)
        } else {
          await actionAddCategory(fd)
        }
        
        // Para simplificar, recargamos la página entera para tener el árbol actualizado real
        // ya que la actualización optimista de árboles anidados es propensa a errores
        window.location.reload()
      } catch (err: any) {
        setFormError(err.message ?? 'Error al guardar')
      }
    })
  }

  const renderCategoryRow = (cat: Category, isSub: boolean = false) => {
    const hasSubs = cat.subcategories && cat.subcategories.length > 0
    const isRootOpen = expandedRoots[cat.id]

    return (
      <div key={cat.id} className="flex flex-col">
        <div className={cn(
          "flex items-center justify-between py-3 group hover:bg-zinc-800/30 transition-colors",
          isSub ? "pl-12 pr-4 border-l-2 border-zinc-800/60 bg-zinc-900/30" : "px-5"
        )}>
          <div className="flex items-center gap-3 flex-1">
            {isSub && <CornerDownRight size={14} className="text-zinc-600 shrink-0 -ml-5" />}
            <span
              className={cn(
                "rounded-xl flex items-center justify-center text-base shrink-0",
                isSub ? "w-7 h-7 text-sm" : "w-9 h-9"
              )}
              style={{ backgroundColor: `${cat.color}22`, border: `1px solid ${cat.color}55` }}
            >
              {cat.icon}
            </span>
            <div className="flex-1">
              <span className={cn("font-medium text-zinc-200", isSub ? "text-xs" : "text-sm")}>
                {cat.name}
              </span>
              {cat.is_cashback && (
                <span className="ml-2 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                  cashback
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {/* Añadir subcategoría (solo en padres) */}
            {!isSub && (
              <button
                type="button"
                onClick={() => openForm({ mode: 'add_sub', parentId: cat.id, defaultType: cat.transaction_type })}
                className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                title="Añadir subcategoría"
              >
                <Plus size={14} />
              </button>
            )}
            
            {/* Editar */}
            <button
              type="button"
              onClick={() => openForm({ mode: 'edit', categoryId: cat.id }, cat)}
              className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Editar"
            >
              <Edit3 size={14} />
            </button>
            
            {/* Borrar */}
            <button
              type="button"
              onClick={() => handleDelete(cat)}
              disabled={deletingId === cat.id}
              className={cn(
                'p-2 rounded-lg transition-all',
                confirmDeleteId === cat.id
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800'
              )}
              title="Borrar"
            >
              {deletingId === cat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>

            {/* Toggle subs si existen y es padre */}
            {!isSub && hasSubs && (
              <button
                type="button"
                onClick={() => toggleRoot(cat.id)}
                className="p-2 text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors ml-1"
              >
                {isRootOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>
        </div>

        {/* Render Subcategorías */}
        {!isSub && hasSubs && isRootOpen && (
          <div className="flex flex-col border-t border-zinc-800/40">
            {cat.subcategories?.map(sub => renderCategoryRow(sub, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Lista agrupada por tipo ────────────────────────── */}
      {(['income', 'expense', 'savings'] as TransactionType[]).map((type) => {
        const roots = groupedCategories[type]
        const isOpen = expanded === type
        return (
          <div key={type} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : type)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/40 transition-colors"
            >
              <span className={cn('text-sm font-bold', TYPE_COLORS[type])}>
                {TYPE_LABELS[type]}
                <span className="ml-2 text-xs font-normal text-zinc-600">
                  ({roots.length} {roots.length === 1 ? 'raíz' : 'raíces'})
                </span>
              </span>
              {isOpen ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
            </button>

            {isOpen && (
              <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/40">
                {roots.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic px-5 py-4 text-center">
                    Sin categorías en {TYPE_LABELS[type].toLowerCase()}.
                  </p>
                ) : (
                  roots.map((cat) => renderCategoryRow(cat, false))
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Formulario (Crear/Editar) ──────────────────────── */}
      <div id="category-form-container">
        {formState ? (
          <div className="rounded-2xl border border-violet-500/50 bg-violet-950/20 p-5 space-y-5 animate-fade-in shadow-xl">
            <div className="flex items-center justify-between border-b border-violet-500/20 pb-3">
              <h3 className="text-sm font-bold text-violet-100 flex items-center gap-2">
                {formState.mode === 'edit' && <Edit3 size={16} className="text-violet-400" />}
                {formState.mode === 'add_root' && <Plus size={16} className="text-violet-400" />}
                {formState.mode === 'add_sub' && <CornerDownRight size={16} className="text-violet-400" />}
                
                {formState.mode === 'edit' ? 'Editar Categoría' : formState.mode === 'add_sub' ? 'Nueva Subcategoría' : 'Nueva Categoría Principal'}
              </h3>
              <button 
                type="button"
                onClick={() => setFormState(null)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                Cerrar
              </button>
            </div>

            {/* Tipo (Solo editable si es root y estamos añadiendo, si es subcat hereda del padre, si es edit no dejamos cambiar parent type fácilmente o sí?) */}
            {formState.mode !== 'add_sub' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">Tipo de transacción</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['income', 'expense', 'savings'] as TransactionType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setFormType(t); if (t !== 'income') setFormIsCashback(false) }}
                      className={cn(
                        'py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all duration-150',
                        formType === t
                          ? cn(TYPE_BG[t], TYPE_COLORS[t])
                          : 'border-zinc-800/80 text-zinc-500 bg-zinc-900/50 hover:border-zinc-700'
                      )}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Nombre */}
            <div className="space-y-2">
              <label htmlFor="cat-name" className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">
                Nombre de la categoría
              </label>
              <input
                id="cat-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={formState.mode === 'add_sub' ? 'Ej: Supermercado' : 'Ej: Alimentación'}
                maxLength={40}
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl border-2 border-zinc-800 bg-zinc-950/80 text-zinc-100 text-sm outline-none focus:border-violet-500/60 transition-all"
              />
            </div>

            {/* Icono */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">Icono representativo</label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 scrollbar-hide">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormIcon(icon)}
                    className={cn(
                      'w-10 h-10 rounded-xl text-lg transition-all duration-150 border-2 flex items-center justify-center',
                      formIcon === icon
                        ? 'border-violet-500 bg-violet-500/20 scale-110 shadow-lg shadow-violet-900/20'
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800'
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">Color de acento</label>
              <div className="flex flex-wrap gap-2.5 p-1">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all duration-150',
                      formColor === color ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
                    )}
                    style={{ backgroundColor: color, boxShadow: formColor === color ? `0 0 12px ${color}80` : 'none' }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Cashback (solo ingresos) */}
            {formType === 'income' && (
              <button
                type="button"
                onClick={() => setFormIsCashback((v) => !v)}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all',
                  formIsCashback
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-800/80 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700'
                )}
              >
                <span>✨</span>
                <span>{formIsCashback ? 'Marcado como Cashback' : 'Marcar como Cashback / Rendimiento'}</span>
              </button>
            )}

            {/* Error */}
            {formError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : (formState.mode === 'edit' ? <CheckCircle2 size={16} /> : <Plus size={16} />)}
                {formState.mode === 'edit' ? 'Guardar Cambios' : 'Crear Categoría'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openForm({ mode: 'add_root' })}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-400 text-sm font-bold hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-violet-400 transition-all duration-200 active:scale-[0.98]"
          >
            <Plus size={18} />
            Añadir Categoría Principal
          </button>
        )}
      </div>
    </div>
  )
}
