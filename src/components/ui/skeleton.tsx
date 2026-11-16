import { cn } from '@/lib/utils'

// Bloque de carga genérico (pulso suave). Solo CSS: sin JS en cliente.
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-xl bg-zinc-800/60', className)} />
}
