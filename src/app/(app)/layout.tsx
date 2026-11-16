import { redirect } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import { getSessionUser } from '@/lib/auth/session'

// Segunda capa de protección (complementa al middleware)
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  return (
    <div className="flex flex-col min-h-[100dvh] bg-zinc-950">
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
