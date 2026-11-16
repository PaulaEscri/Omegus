import { Skeleton } from '@/components/ui/skeleton'

export default function CarteraLoading() {
  return (
    <div className="min-h-full bg-zinc-950" role="status" aria-label="Cargando cartera">
      <div className="px-5 pt-8 pb-6 max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  )
}
