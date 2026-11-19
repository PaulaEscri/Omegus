'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Landmark, Loader2, Plus, RefreshCw, Search, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BASE_PATH } from '@/lib/basePath'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface BankGroup {
  id: string // id de una de sus filas (sirve para sincronizar / desconectar la sesión entera)
  bankName: string
  ibans: string[]
  expiresAt: string
  lastSyncedAt: string | null
  lastError: string | null
}

interface AccountOption {
  id: string
  name: string
}

interface Props {
  configured: boolean
  groups: BankGroup[]
  accounts: AccountOption[]
  status: string | null // ?bank=connected|denied|error
  reason: string | null
}

const POPULAR = ['BBVA', 'Santander', 'CaixaBank', 'ING', 'Revolut']
const DAY_MS = 86400_000

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const REASONS: Record<string, string> = {
  state: 'No se pudo verificar la autorización (la sesión del navegador cambió). Inténtalo de nuevo.',
  session: 'El banco no confirmó la autorización. Inténtalo de nuevo.',
  save: 'El banco se conectó, pero no se pudo guardar. Se ha revocado el acceso; inténtalo de nuevo.',
}

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const res = await fetch(`${BASE_PATH}${path}`, init)
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    return { ok: res.ok, data: res.ok ? data : { ...data, error: data.error ?? `Error ${res.status}` } }
  } catch (err) {
    return { ok: false, data: { error: `Sin conexión con el servidor (${(err as Error).message})` } as T & { error?: string } }
  }
}

function lastSyncLabel(iso: string | null, now: number): string {
  if (!iso) return 'Aún sin sincronizar'
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'Sincronizado ahora'
  if (mins < 60) return `Sincronizado hace ${mins} min`
  const h = Math.round(mins / 60)
  if (h < 48) return `Sincronizado hace ${h} h`
  return `Sincronizado hace ${Math.round(h / 24)} días`
}

// ── Modal "Conectar banco" ───────────────────────────────────
function ConnectModal({
  accounts,
  initialBank,
  onClose,
}: {
  accounts: AccountOption[]
  initialBank: string | null
  onClose: () => void
}) {
  const [banks, setBanks] = useState<string[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [bank, setBank] = useState<string | null>(initialBank)
  const [accountId, setAccountId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api<{ aspsps: { name: string }[] }>('/api/bank/aspsps').then(({ ok, data }) => {
      if (!alive) return
      if (!ok) setLoadError(data.error ?? 'No se pudo cargar la lista de bancos.')
      else setBanks(data.aspsps.map((a) => a.name))
    })
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!banks) return []
    const q = norm(query)
    return (q ? banks.filter((b) => norm(b).includes(q)) : banks).slice(0, 60)
  }, [banks, query])

  // Al elegir banco, sugiere la cuenta de Omegus con nombre parecido
  const pick = (name: string) => {
    setBank(name)
    const first = norm(name).split(' ')[0]
    const match = accounts.find((a) => norm(a.name).includes(first))
    setAccountId(match?.id ?? '')
    setError('')
  }

  const connect = async () => {
    if (!bank || connecting) return
    setConnecting(true)
    setError('')
    const { ok, data } = await api<{ url: string }>('/api/bank/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank, accountId: accountId || null }),
    })
    if (!ok || !data.url) {
      setError(data.error ?? 'No se pudo iniciar la conexión.')
      setConnecting(false)
      return
    }
    window.location.href = data.url // el banco pide la autorización; el cargando sigue hasta salir
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => !connecting && onClose()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conectar banco"
        className="relative z-10 w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 animate-scale-in"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-100">{bank ? 'Importar en…' : 'Conectar banco'}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={connecting}
            aria-label="Cerrar"
            className="p-2 -mr-2 text-zinc-500 hover:text-zinc-300"
          >
            <X size={20} />
          </button>
        </div>

        {!bank ? (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca tu banco"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 outline-none bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-700 text-base font-medium border-zinc-800 focus:border-violet-500/60"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {POPULAR.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setQuery(p)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  {p}
                </button>
              ))}
            </div>

            {loadError ? (
              <div role="alert" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle size={16} className="shrink-0" />
                <span>{loadError}</span>
              </div>
            ) : !banks ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
                <Loader2 size={18} className="animate-spin" /> Cargando bancos…
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-zinc-600 py-6">Sin resultados</p>
            ) : (
              <ul className="rounded-2xl border border-zinc-800/70 divide-y divide-zinc-800/40 overflow-hidden">
                {filtered.map((b) => (
                  <li key={b}>
                    <button
                      type="button"
                      onClick={() => pick(b)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 active:bg-zinc-800"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold shrink-0">
                        {b.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-zinc-200 truncate">{b}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-400">
              Banco: <span className="font-semibold text-zinc-100">{bank}</span>{' '}
              <button type="button" onClick={() => setBank(null)} disabled={connecting} className="text-violet-400 hover:text-violet-300 text-xs font-semibold">
                Cambiar
              </button>
            </p>

            <div className="space-y-1.5">
              <label htmlFor="bank-account" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Importar los gastos en
              </label>
              <select
                id="bank-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={connecting}
                className="w-full px-4 py-3 rounded-xl border-2 outline-none bg-zinc-900/80 text-zinc-100 text-base font-medium border-zinc-800 focus:border-violet-500/60"
              >
                <option value="">Crear una cuenta nueva</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              Serás redirigida a tu banco para autorizar el acceso de <strong className="text-zinc-300">solo lectura</strong> durante
              90 días. Omegus nunca ve ni guarda tus claves del banco.{' '}
              <Link href="/privacy" className="text-violet-400 hover:text-violet-300">
                Más información
              </Link>
            </p>

            {error && (
              <div role="alert" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={connect}
              disabled={connecting}
              className="w-full h-14 rounded-2xl text-base font-bold bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Abriendo tu banco…</span>
                </>
              ) : (
                'Conectar'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sección principal ────────────────────────────────────────
export function BankConnections({ configured, groups, accounts, status, reason }: Props) {
  const router = useRouter()
  const [now] = useState(() => Date.now())
  const [modal, setModal] = useState<{ bank: string | null } | null>(null)
  const [toDelete, setToDelete] = useState<BankGroup | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(() => {
    if (status === 'denied') return { kind: 'error', text: 'Has cancelado la autorización en el banco.' }
    if (status === 'error') return { kind: 'error', text: REASONS[reason ?? ''] ?? 'No se pudo completar la conexión con el banco.' }
    return null
  })
  const firstSyncDone = useRef(false)

  // Al volver del banco: primera importación automática y limpia la URL
  useEffect(() => {
    if (status !== 'connected' || firstSyncDone.current) return
    firstSyncDone.current = true
    router.replace('/ajustes')
    setSyncingId('all')
    api<{ inserted: number }>('/api/bank/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(({ ok, data }) => {
      setSyncingId(null)
      setNotice(
        ok
          ? { kind: 'ok', text: `Banco conectado. ${data.inserted > 0 ? `${data.inserted} gasto(s) importado(s).` : 'Sin gastos nuevos en los últimos 15 días.'}` }
          : { kind: 'error', text: `Banco conectado, pero la primera sincronización falló: ${data.error ?? 'inténtalo con «Sincronizar ahora».'}` }
      )
      router.refresh()
    })
  }, [status, router])

  const sync = async (g: BankGroup) => {
    setSyncingId(g.id)
    setNotice(null)
    const { ok, data } = await api<{ inserted: number; results: { status: string; message?: string }[] }>(
      '/api/bank/sync',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId: g.id }) }
    )
    setSyncingId(null)
    if (!ok && !data.results) {
      setNotice({ kind: 'error', text: data.error ?? 'No se pudo sincronizar.' })
    } else {
      const firstProblem = data.results?.find((r) => r.status !== 'ok')
      if (firstProblem?.status === 'error') setNotice({ kind: 'error', text: firstProblem.message ?? 'No se pudo sincronizar.' })
      else if (firstProblem?.status === 'skipped') setNotice({ kind: 'ok', text: firstProblem.message ?? 'Sincronizada hace poco.' })
      else setNotice({ kind: 'ok', text: data.inserted > 0 ? `${data.inserted} gasto(s) nuevo(s) importado(s).` : 'Todo al día: no hay gastos nuevos.' })
    }
    router.refresh()
  }

  const disconnect = async () => {
    if (!toDelete) return
    setDeleting(true)
    const { ok, data } = await api<{ ok: boolean }>('/api/bank/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: toDelete.id }),
    })
    setDeleting(false)
    setToDelete(null)
    setNotice(ok ? { kind: 'ok', text: 'Banco desconectado. Tus movimientos importados se conservan.' } : { kind: 'error', text: data.error ?? 'No se pudo desconectar.' })
    router.refresh()
  }

  return (
    <section aria-labelledby="bancos-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="bancos-title" className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
          Bancos conectados
        </h2>
        {configured && (
          <button
            type="button"
            onClick={() => setModal({ bank: null })}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-500 active:scale-95 transition-all"
          >
            <Plus size={14} /> Conectar banco
          </button>
        )}
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm animate-fade-in',
            notice.kind === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          )}
        >
          {notice.kind === 'error' ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
          <span>{notice.text}</span>
        </div>
      )}

      {!configured ? (
        <p className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 px-5 py-4 text-sm text-zinc-500">
          La conexión bancaria aún no está activada en este servidor.
        </p>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 px-5 py-6 text-center">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-blue-500/15 mb-3">
            <Landmark size={20} className="text-blue-400" />
          </span>
          <p className="text-sm text-zinc-400">Conecta tu banco y tus gastos se importarán solos.</p>
          <p className="text-xs text-zinc-600 mt-1">Solo lectura · Open Banking regulado (PSD2)</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const daysLeft = Math.ceil((new Date(g.expiresAt).getTime() - now) / DAY_MS)
            const expired = daysLeft <= 0
            const warning = !expired && daysLeft < 7
            const busy = syncingId === g.id || syncingId === 'all'
            return (
              <li key={g.id} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/15 shrink-0">
                    <Landmark size={19} className="text-blue-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">{g.bankName}</p>
                    {g.ibans.map((iban) => (
                      <p key={iban} className="text-xs text-zinc-500 font-mono truncate">{iban}</p>
                    ))}
                    <p className="text-[11px] text-zinc-600 mt-1">{lastSyncLabel(g.lastSyncedAt, now)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToDelete(g)}
                    aria-label={`Desconectar ${g.bankName}`}
                    className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                    expired ? 'bg-red-500/10 text-red-400' : warning ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800/60 text-zinc-400'
                  )}
                >
                  {(expired || warning) && <AlertTriangle size={14} className="shrink-0" />}
                  <span>
                    {expired
                      ? 'La conexión ha caducado. Vuelve a conectar el banco.'
                      : warning
                        ? `Caduca en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}: reconecta pronto.`
                        : `Caduca en ${daysLeft} días`}
                  </span>
                </div>

                {g.lastError && !expired && (
                  <p className="text-xs text-red-400/90 leading-relaxed">{g.lastError}</p>
                )}

                {expired || warning ? (
                  <button
                    type="button"
                    onClick={() => setModal({ bank: g.bankName })}
                    className="w-full h-11 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.98] transition-all"
                  >
                    Reconectar
                  </button>
                ) : null}

                {!expired && (
                  <button
                    type="button"
                    onClick={() => sync(g)}
                    disabled={busy}
                    className="w-full h-11 rounded-xl text-sm font-bold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {modal && <ConnectModal accounts={accounts} initialBank={modal.bank} onClose={() => setModal(null)} />}

      <ConfirmDialog
        open={toDelete !== null}
        title="¿Desconectar este banco?"
        description="Se revocará el acceso en el banco. Los movimientos ya importados se conservan."
        confirmLabel="Desconectar"
        loading={deleting}
        onConfirm={disconnect}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}
