import { Skeleton } from '@/components/ui/skeleton'

export default function AjustesLoading() {
  return (
    <div className="min-h-full bg-zinc-950" role="status" aria-label="Cargando ajustes">
      <div className="px-5 pt-8 pb-6 max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 divide-y divide-zinc-800/40">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5 px-5 py-4">
              <Skeleton className="h-10 w-10 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
