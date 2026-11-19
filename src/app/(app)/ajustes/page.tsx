import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Settings2, Shapes, Wallet, ShieldCheck, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getIsAdmin } from '@/lib/auth/admin'
import { cn } from '@/lib/utils'
import { getSessionUser } from '@/lib/auth/session'
import { isBankingConfigured } from '@/lib/bank/enableBanking'
import { BankConnections, type BankGroup } from '@/components/ajustes/BankConnections'

export const metadata: Metadata = {
  title: 'Ajustes · Finanzas',
  description: 'Gestiona tus categorías, cuentas y preferencias.',
}

export const dynamic = 'force-dynamic'

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string; reason?: string }>
}) {
  const { bank, reason } = await searchParams
  const supabase = await createClient()
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [{ count: categoryCount }, { count: accountCount }, isAdmin, bankRes, accountsRes] = await Promise.all([
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
    getIsAdmin(supabase, user.id),
    // Si la migración de bancos aún no se ha ejecutado, devuelve error y la sección sale vacía
    supabase
      .from('bank_connections' as never)
      .select('id, session_id, bank_name, iban_masked, expires_at, last_synced_at, last_error')
      .order('created_at'),
    supabase.from('accounts').select('id, name').eq('is_active', true).order('sort_order'),
  ])

  // Una tarjeta por sesión bancaria (una sesión puede incluir varias cuentas)
  const bankRows = ((bankRes.data ?? []) as unknown as {
    id: string; session_id: string; bank_name: string; iban_masked: string | null
    expires_at: string; last_synced_at: string | null; last_error: string | null
  }[])
  const bankMap = new Map<string, BankGroup>()
  for (const r of bankRows) {
    const g = bankMap.get(r.session_id)
    if (!g) {
      bankMap.set(r.session_id, {
        id: r.id,
        bankName: r.bank_name,
        ibans: r.iban_masked ? [r.iban_masked] : [],
        expiresAt: r.expires_at,
        lastSyncedAt: r.last_synced_at,
        lastError: r.last_error,
      })
    } else {
      if (r.iban_masked) g.ibans.push(r.iban_masked)
      if (r.expires_at < g.expiresAt) g.expiresAt = r.expires_at
      if (r.last_synced_at && (!g.lastSyncedAt || r.last_synced_at < g.lastSyncedAt)) g.lastSyncedAt = r.last_synced_at
      g.lastError = g.lastError ?? r.last_error
    }
  }
  const bankGroups = [...bankMap.values()]
  const accountOptions = ((accountsRes.data ?? []) as { id: string; name: string }[])

  const menuItems = [
    {
      href: '/ajustes/categorias',
      label: 'Gestionar Categorías',
      description: `${categoryCount ?? 0} ${categoryCount === 1 ? 'categoría activa' : 'categorías activas'}`,
      icon: Shapes,
      color: 'text-violet-400',
      bg: 'bg-violet-500/15',
    },
    {
      href: '/ajustes/cuentas',
      label: 'Gestionar Cuentas',
      description: `${accountCount ?? 0} ${accountCount === 1 ? 'cuenta activa' : 'cuentas activas'}`,
      icon: Wallet,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
    },
    ...(isAdmin
      ? [
          {
            href: '/admin',
            label: 'Panel de Admin',
            description: 'Crear, editar y eliminar usuarios',
            icon: ShieldCheck,
            color: 'text-amber-400',
            bg: 'bg-amber-500/15',
          },
        ]
      : []),
  ]

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
              <p className="text-xs text-zinc-500">Gestiona tus categorías y cuentas</p>
            </div>
          </div>
        </header>

        {/* ── MENÚ VERTICAL ─────────────────────────────────── */}
        <nav
          aria-label="Secciones de ajustes"
          className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 overflow-hidden divide-y divide-zinc-800/40"
        >
          {menuItems.map(({ href, label, description, icon: Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3.5 px-5 py-4 hover:bg-zinc-800/40 active:bg-zinc-800/60 transition-colors"
            >
              <span className={cn('flex items-center justify-center w-10 h-10 rounded-xl shrink-0', bg)}>
                <Icon size={19} className={color} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-200">{label}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{description}</p>
              </div>
              <ChevronRight size={18} className="text-zinc-600 shrink-0" />
            </Link>
          ))}
        </nav>

        {/* ── BANCOS CONECTADOS ─────────────────────────────── */}
        <BankConnections
          configured={isBankingConfigured()}
          groups={bankGroups}
          accounts={accountOptions}
          status={bank ?? null}
          reason={reason ?? null}
        />

      </div>
    </div>
  )
}
