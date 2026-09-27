'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, TrendingUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPastSavingsConcepts } from '@/lib/queries/portfolio'

interface AssetComboboxProps {
  value: string
  onChange: (val: string) => void
  error?: string
}

export function AssetCombobox({ value, onChange, error }: AssetComboboxProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [allConcepts, setAllConcepts] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cargar conceptos previos al montar
  useEffect(() => {
    getPastSavingsConcepts()
      .then(setAllConcepts)
      .finally(() => setLoading(false))
  }, [])

  // Filtrar sugerencias cuando cambia el query
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions(allConcepts.slice(0, 8))
    } else {
      const q = query.toLowerCase()
      setSuggestions(
        allConcepts
          .filter((c) => c.toLowerCase().includes(q))
          .slice(0, 8)
      )
    }
  }, [query, allConcepts])

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    setOpen(true)
  }

  const handleSelect = (concept: string) => {
    setQuery(concept)
    onChange(concept)
    setOpen(false)
  }

  const handleClear = () => {
    setQuery('')
    onChange('')
    setOpen(false)
  }

  const showDropdown = open && (suggestions.length > 0 || (!loading && allConcepts.length === 0))
  // ¿El valor actual es nuevo (no existe en el historial)?
  const isNewAsset = query.trim() && !allConcepts.some((c) => c.toLowerCase() === query.trim().toLowerCase())

  return (
    <div ref={containerRef} className="relative">
      {/* Input principal */}
      <div className="relative">
        <TrendingUp
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none"
        />
        <input
          id="concept-asset-input"
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder="Ej: Bitcoin, MSCI World, Tesla…"
          autoComplete="off"
          aria-label="Activo o ticker"
          aria-invalid={!!error}
          aria-describedby={error ? 'concept-asset-error' : undefined}
          className={cn(
            'w-full pl-10 pr-10 py-3.5 rounded-xl border-2 outline-none',
            'bg-zinc-900/80 text-zinc-100 text-sm placeholder:text-zinc-600',
            'transition-all duration-200',
            error
              ? 'border-red-500/60'
              : 'border-blue-500/40 focus:border-blue-500/70'
          )}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Borrar"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Badge "Activo nuevo" */}
      {isNewAsset && (
        <p className="mt-1.5 px-1 text-[11px] text-blue-400 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
          Activo nuevo — se añadirá a tu cartera
        </p>
      )}

      {/* Error */}
      {error && (
        <p id="concept-asset-error" role="alert" className="mt-1.5 text-xs text-red-400 px-1">
          {error}
        </p>
      )}

      {/* Dropdown de sugerencias */}
      {showDropdown && (
        <div
          role="listbox"
          aria-label="Activos previos"
          className={cn(
            'absolute z-50 mt-1.5 w-full rounded-xl border border-zinc-700/80',
            'bg-zinc-900/95 backdrop-blur-sm shadow-xl overflow-hidden',
            'animate-fade-in'
          )}
        >
          {/* Header del dropdown */}
          {allConcepts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
              <Search size={11} className="text-zinc-500" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                {query ? 'Coincidencias' : 'Tus activos anteriores'}
              </span>
            </div>
          )}

          {suggestions.length === 0 && !loading ? (
            <div className="px-4 py-3 text-xs text-zinc-500 italic">
              {allConcepts.length === 0
                ? 'Aún no tienes inversiones registradas. ¡Sé el primero!'
                : 'No hay coincidencias — escribe para crear activo nuevo'}
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto divide-y divide-zinc-800/50">
              {suggestions.map((concept) => (
                <li key={concept}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={query === concept}
                    onClick={() => handleSelect(concept)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm transition-colors duration-100',
                      'flex items-center gap-2.5',
                      query === concept
                        ? 'bg-blue-500/15 text-blue-300'
                        : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100'
                    )}
                  >
                    <TrendingUp size={13} className="text-blue-400/70 shrink-0" />
                    {concept}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
