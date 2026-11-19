import { Skeleton } from '@/components/ui/skeleton'

export default function HistorialLoading() {
  return (
    <div className="min-h-full bg-zinc-950" role="status" aria-label="Cargando historial">
      <div className="px-5 pt-8 pb-6 max-w-md mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
