'use client'

import { useMemo, useState } from 'react'
import { Loader2, AlertCircle, Pencil, Trash2, Plus, Search, X, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/errors'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
} from '@/app/(app)/admin/actions'

export interface AdminUserRow {
  id: string
  username: string | null
  email: string
  isAdmin: boolean
  createdAt: string
}

const inputClass = cn(
  'w-full px-4 py-3 rounded-xl border-2 outline-none',
  'bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700',
  'text-base font-medium transition-all duration-200',
  'border-zinc-800 focus:border-violet-500/60 disabled:opacity-60'
)
const labelClass = 'block text-xs font-semibold text-zinc-500 uppercase tracking-wider'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Formulario (crear / editar) ───────────────────────────────
function UserFormModal({
  user,
  isSelf,
  onClose,
}: {
  user: AdminUserRow | null // null = crear
  isSelf: boolean
  onClose: () => void
}) {
  const editing = user !== null
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError(reportError('AUTH-004'))
      return
    }
    if (password && password.length < 6) {
      setError(reportError('AUTH-012'))
      return
    }
    if (!editing && !password) {
      setError(reportError('AUTH-012'))
      return
    }

    setSaving(true)
    try {
      const result = editing
        ? await adminUpdateUser({
            id: user.id,
            username,
            email,
            isAdmin,
            newPassword: password || undefined,
          })
        : await adminCreateUser({ username, email, password, isAdmin })

      if (!result.ok) {
        setError(reportError(result.code))
        setSaving(false)
        return
      }
      onClose()
    } catch (err: unknown) {
      setError(reportError('AUTH-001', err))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => !saving && onClose()}
        aria-hidden="true"
      />
      <form
        onSubmit={handleSubmit}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Editar usuario' : 'Crear usuario'}
        className="relative z-10 w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 animate-scale-in"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-100">
            {editing ? 'Editar usuario' : 'Crear usuario'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            className="p-2 -mr-2 text-zinc-500 hover:text-zinc-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-username" className={labelClass}>Usuario</label>
          <input
            id="admin-username"
            type="text"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            disabled={saving}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-email" className={labelClass}>Email</label>
          <input
            id="admin-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            disabled={saving}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-password" className={labelClass}>
            {editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
          </label>
          <input
            id="admin-password"
            type="text"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={editing ? 'Dejar vacío para no cambiarla' : 'Mínimo 6 caracteres'}
            disabled={saving}
            className={inputClass}
          />
        </div>

        <label
          className={cn(
            'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-zinc-800 bg-zinc-900/80',
            isSelf && 'opacity-60'
          )}
        >
          <span>
            <span className="block text-sm font-semibold text-zinc-200">Administrador</span>
            <span className="block text-xs text-zinc-600">
              {isSelf ? 'No puedes quitarte el rol a ti mismo' : 'Acceso al panel de admin'}
            </span>
          </span>
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            disabled={saving || isSelf}
            className="w-5 h-5 accent-violet-600"
          />
        </label>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-bold bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Guardando…</span>
            </>
          ) : editing ? (
            'Guardar cambios'
          ) : (
            'Crear usuario'
          )}
        </button>
      </form>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────
export function AdminUsers({
  users,
  currentUserId,
}: {
  users: AdminUserRow[]
  currentUserId: string
}) {
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<{ user: AdminUserRow | null } | null>(null)
  const [toDelete, setToDelete] = useState<AdminUserRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.username ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [users, query])

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError('')
    try {
      const result = await adminDeleteUser(toDelete.id)
      if (!result.ok) {
        setDeleteError(reportError(result.code))
        setDeleting(false)
        setToDelete(null)
        return
      }
    } catch (err: unknown) {
      setDeleteError(reportError('AUTH-001', err))
    }
    setDeleting(false)
    setToDelete(null)
  }

  return (
    <div className="space-y-4">
      {/* Resumen + crear */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-900/50 px-4 py-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/15 shrink-0">
            <Users size={19} className="text-blue-400" />
          </span>
          <div>
            <p className="text-2xl font-bold leading-none text-zinc-50">{users.length}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {users.length === 1 ? 'usuario total' : 'usuarios totales'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModal({ user: null })}
          aria-label="Crear usuario"
          className="flex items-center justify-center gap-1.5 h-[4.25rem] px-4 rounded-2xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 active:scale-95 transition-all shadow-lg shadow-violet-600/25"
        >
          <Plus size={18} />
          Crear
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por usuario o email"
          autoCapitalize="none"
          spellCheck={false}
          className={cn(inputClass, 'pl-10')}
        />
      </div>

      {deleteError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-zinc-600 py-10">Sin resultados</p>
      ) : (
        <ul className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 overflow-hidden divide-y divide-zinc-800/40">
          {filtered.map((u) => {
            const isSelf = u.id === currentUserId
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-200 truncate">
                      {u.username || 'Sin usuario'}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                        u.isAdmin
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-zinc-800 text-zinc-400'
                      )}
                    >
                      {u.isAdmin ? 'Admin' : 'Usuario'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{u.email}</p>
                  <p className="text-[11px] text-zinc-700 mt-0.5">Alta: {formatDate(u.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ user: u })}
                  aria-label={`Editar ${u.username ?? u.email}`}
                  className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <Pencil size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(u)}
                  disabled={isSelf}
                  aria-label={`Eliminar ${u.username ?? u.email}`}
                  title={isSelf ? 'No puedes eliminarte a ti mismo' : undefined}
                  className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 size={17} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {modal && (
        <UserFormModal
          user={modal.user}
          isSelf={modal.user?.id === currentUserId}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="¿Eliminar usuario?"
        description={`Se borrará ${toDelete?.username ?? toDelete?.email ?? ''} y todos sus datos. No se puede deshacer.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
