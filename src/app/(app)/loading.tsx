import { Skeleton } from '@/components/ui/skeleton'

// Esqueleto genérico mientras se carga cualquier pestaña de (app).
// Se muestra al instante al navegar; el contenido real llega por streaming.
export default function AppLoading() {
  return (
    <div className="min-h-full bg-zinc-950" role="status" aria-label="Cargando">
      <div className="px-5 pt-8 pb-6 max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  )
}
