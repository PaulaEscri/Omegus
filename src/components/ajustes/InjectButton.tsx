'use client'

import { useState, useTransition } from 'react'
import { Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { injectDefinitiveStructure } from '@/app/(app)/ajustes/seedActions'

export function InjectButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleInject = () => {
    startTransition(async () => {
      const res = await injectDefinitiveStructure()
      setResult(res)
      if (res.ok) {
        setTimeout(() => {
            setResult(null)
            window.location.reload()
        }, 2000)
      }
    })
  }

  return (
    <div className="rounded-2xl border border-dashed border-violet-500/40 bg-violet-500/5 p-4 space-y-3 mt-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Database size={14} className="text-violet-400" />
        <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">
          Inicialización de estructura
        </span>
      </div>
      
      <p className="text-xs text-zinc-400">
        Haz clic para generar automáticamente tus Cuentas y Categorías base.
      </p>

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
        onClick={handleInject}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 text-xs font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Inyectando...
          </>
        ) : (
          <>
            <Database size={13} />
            Inyectar Estructura Definitiva
          </>
        )}
      </button>
    </div>
  )
}
