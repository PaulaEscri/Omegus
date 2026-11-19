'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BASE_PATH } from '@/lib/basePath'

// Sincronización bancaria en segundo plano. El servidor solo monta este componente
// si hay alguna cuenta sin consultar en las últimas 6 h, y /api/bank/sync lo vuelve a
// comprobar (límite PSD2). Silencioso: los fallos se ven en Ajustes → Bancos conectados.
export function BankAutoSync() {
  const router = useRouter()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    fetch(`${BASE_PATH}/api/bank/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto: true }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { inserted?: number } | null) => {
        if (data && (data.inserted ?? 0) > 0) router.refresh()
      })
      .catch(() => undefined)
  }, [router])

  return null
}
