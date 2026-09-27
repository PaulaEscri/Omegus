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

  return { accounts, isLoading, error }
}
