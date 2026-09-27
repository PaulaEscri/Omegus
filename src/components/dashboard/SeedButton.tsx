'use client'

import { useState, useTransition } from 'react'
import { Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { seedMockData } from '@/app/(app)/dashboard/actions'

export function SeedButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleSeed = () => {
    startTransition(async () => {
      const res = await seedMockData()
      setResult(res)
      if (res.ok) {
        setTimeout(() => setResult(null), 6000)
      }
    })
  }

  return (
    <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Database size={14} className="text-amber-400" />
        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
          Modo desarrollo · Datos demo
        </span>
      </div>

      {result && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs font-medium ${
          result.ok
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {result.ok
            ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
            : <AlertCircle size={13} className="shrink-0 mt-0.5" />
          }
          <span>{result.message}</span>
        </div>
      )}

      <button
        type="button"
        id="btn-seed-mock-data"
        onClick={handleSeed}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Generando datos…
          </>
        ) : (
          <>
            <Database size={13} />
            Cargar datos demo
          </>
        )}
      </button>
    </div>
  )
}
