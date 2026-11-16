import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { ViewportSync } from '@/components/layout/ViewportSync'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

// Mismo criterio que next.config.ts: en producción la app vive bajo /omegus.
// Las URLs de metadata/<link> escritas a mano no reciben el basePath solas.
const BASE = process.env.NODE_ENV === 'production' ? '/omegus' : ''

export const metadata: Metadata = {
  title: {
    default: 'Finanzas Personales',
    template: '%s | Finanzas',
  },
  description: 'Control total de tus finanzas personales: ingresos, gastos, ahorro e inversión.',
  applicationName: 'Finanzas Personales',
  manifest: `${BASE}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Finanzas',
  },
  other: {
    'format-detection': 'telephone=no, date=no',
    'msapplication-tap-highlight': 'no',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Sin maximumScale/userScalable: los <input> ya fuerzan 16px (globals.css),
  // que es lo que evita el zoom automático de iOS, y así no se bloquea el zoom
  // de accesibilidad.
  viewportFit: 'cover',
  themeColor: '#09090b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} dark`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href={`${BASE}/icons/apple-touch-icon.png`} />
        <link rel="icon" type="image/png" sizes="192x192" href={`${BASE}/icons/icon-192.png`} />
      </head>
      <body className="min-h-[100dvh] bg-zinc-950 text-zinc-50 antialiased overflow-x-hidden selection:bg-violet-500/30">
        <ViewportSync />
        {children}
      </body>
    </html>
  )
}
