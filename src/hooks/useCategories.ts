'use client'

import { useState, useEffect } from 'react'
import type { Category } from '@/types/database'
import { getCategoriesWithChildren } from '@/lib/queries/categories'

export function useCategories(transactionType: string) {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!transactionType) return

    setIsLoading(true)
    setError(null)

    getCategoriesWithChildren(transactionType)
      .then(setCategories)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [transactionType])

  return { categories, isLoading, error }
}
