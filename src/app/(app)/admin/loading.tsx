import { Skeleton } from '@/components/ui/skeleton'

export default function AdminLoading() {
  return (
    <div className="min-h-full bg-zinc-950" role="status" aria-label="Cargando panel de admin">
      <div className="px-5 pt-8 pb-6 max-w-md mx-auto space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-[4.25rem] flex-1 rounded-2xl" />
          <Skeleton className="h-[4.25rem] w-24 rounded-2xl" />
        </div>
        <Skeleton className="h-12 w-full" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
