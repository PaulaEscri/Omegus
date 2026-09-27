'use client'

import { useState, useEffect } from 'react'
import type { Account } from '@/types/database'
import { getAccounts } from '@/lib/queries/accounts'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    getAccounts()
      .then(setAccounts)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  // Filtrar por tipo para el selector de cuenta destino (savings)
  const brokerAccounts = accounts.filter((a) => a.type === 'broker')
  const liquidAccounts = accounts.filter((a) => a.type !== 'broker')

  return { accounts, brokerAccounts, liquidAccounts, isLoading, error }
}
