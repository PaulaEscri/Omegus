'use client'

import { useState, useTransition } from 'react'
import { Trash2, Plus, Loader2, AlertCircle, CheckCircle2, Edit3, Wallet, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { actionAddAccount, actionDeleteAccount, actionUpdateAccount } from '@/app/(app)/ajustes/accountActions'
import { isProtectedAccount } from '@/lib/protectedEntities'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Account, AccountType } from '@/types/database'

const COLOR_PALETTE = [
  '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#a855f7', '#06b6d4', '#eab308', '#64748b', '#d946ef',
]

const ICON_OPTIONS = [
  '💵', '🏦', '💳', '📈', '🪙', '💶', '🏧', '💰',
  '🐖', '📊', '🌐', '💼', '🏛️', '📱',
]

type Props = {
  initialAccounts: Account[]
}

const TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Efectivo',
  bank: 'Banco',
  broker: 'Bróker / Inversión',
  digital: 'Digital',
}

const TYPE_COLORS: Record<AccountType, string> = {
  cash: 'text-amber-400',
  bank: 'text-emerald-400',
  broker: 'text-blue-400',
  digital: 'text-violet-400',
}

const TYPE_BG: Record<AccountType, string> = {
  cash: 'bg-amber-500/10 border-amber-500/30',
  bank: 'bg-emerald-500/10 border-emerald-500/30',
  broker: 'bg-blue-500/10 border-blue-500/30',
  digital: 'bg-violet-500/10 border-violet-500/30',
}

type FormState = {
  mode: 'add' | 'edit'
  accountId?: string
}

export function AccountManager({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)

  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)

  const [formState, setFormState] = useState<FormState | null>(null)
  const [formType, setFormType] = useState<AccountType>('bank')
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState(COLOR_PALETTE[0])
  const [formIcon, setFormIcon] = useState(ICON_OPTIONS[0])
  const [formError, setFormError] = useState('')

  const [isPending, startTransition] = useTransition()

  const openForm = (state: FormState, acc?: Account) => {
    setFormState(state)
    setFormError('')
    if (state.mode === 'edit' && acc) {
      setFormType(acc.type)
      setFormName(acc.name)
      setFormColor(acc.color)
      setFormIcon(acc.icon)
    } else {
      setFormType('bank')
      setFormName('')
      setFormColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)])
      setFormIcon(ICON_OPTIONS[0])
    }

    setTimeout(() => {
      document.getElementById('account-form-container')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleDeleteClick = (acc: Account) => {
    if (isProtectedAccount(acc)) return
    setPendingDelete(acc)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    const acc = pendingDelete
    startTransition(async () => {
      try {
        await actionDeleteAccount(acc.id)
        setAccounts((prev) => prev.filter((a) => a.id !== acc.id))
      } catch (err) {
        console.error(err)
      } finally {
        setPendingDelete(null)
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
    fd.set('type', formType)
    fd.set('color', formColor)
    fd.set('icon', formIcon)

    startTransition(async () => {
      try {
        if (formState.mode === 'edit' && formState.accountId) {
          await actionUpdateAccount(formState.accountId, fd)
        } else {
          await actionAddAccount(fd)
        }
        // Recargamos para reflejar el estado real (orden, saldos derivados, etc.)
        window.location.reload()
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Lista de cuentas ────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 overflow-hidden">
        {accounts.length === 0 ? (
          <p className="text-xs text-zinc-600 italic px-5 py-6 text-center">
            Sin cuentas configuradas aún.
          </p>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {accounts.map((acc) => {
              const protectedAcc = isProtectedAccount(acc)
              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between py-3 px-5 group hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ backgroundColor: `${acc.color}22`, border: `1px solid ${acc.color}55` }}
                    >
                      {acc.icon}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-zinc-200">{acc.name}</span>
                        {protectedAcc && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                            <Lock size={9} />
                            protegida
                          </span>
                        )}
                      </div>
                      <span className={cn('text-[11px] font-medium', TYPE_COLORS[acc.type])}>
                        {TYPE_LABELS[acc.type]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openForm({ mode: 'edit', accountId: acc.id }, acc)}
                      className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteClick(acc)}
                      disabled={protectedAcc}
                      className={cn(
                        'p-2 rounded-lg transition-all',
                        protectedAcc
                          ? 'text-zinc-700 cursor-not-allowed'
                          : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800'
                      )}
                      title={protectedAcc ? 'Cuenta del sistema: no se puede eliminar' : 'Borrar'}
                    >
                      {protectedAcc ? <Lock size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Formulario (Crear/Editar) ──────────────────────── */}
      <div id="account-form-container">
        {formState ? (
          <div className="rounded-2xl border border-violet-500/50 bg-violet-950/20 p-5 space-y-5 animate-fade-in shadow-xl">
            <div className="flex items-center justify-between border-b border-violet-500/20 pb-3">
              <h3 className="text-sm font-bold text-violet-100 flex items-center gap-2">
                {formState.mode === 'edit' ? <Edit3 size={16} className="text-violet-400" /> : <Plus size={16} className="text-violet-400" />}
                {formState.mode === 'edit' ? 'Editar Cuenta' : 'Nueva Cuenta'}
              </h3>
              <button
                type="button"
                onClick={() => setFormState(null)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                Cerrar
              </button>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">Tipo de cuenta</label>
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'bank', 'broker', 'digital'] as AccountType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormType(t)}
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

            {/* Nombre */}
            <div className="space-y-2">
              <label htmlFor="acc-name" className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">
                Nombre de la cuenta
              </label>
              <input
                id="acc-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: BBVA, Revolut, Trade Republic"
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
                {formState.mode === 'edit' ? 'Guardar Cambios' : 'Crear Cuenta'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openForm({ mode: 'add' })}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-400 text-sm font-bold hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-violet-400 transition-all duration-200 active:scale-[0.98]"
          >
            <Wallet size={18} />
            Añadir Cuenta
          </button>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `¿Eliminar "${pendingDelete.name}"?` : ''}
        description="Los movimientos ya registrados se conservan."
        loading={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
