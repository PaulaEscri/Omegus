'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    cancelRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => !loading && onCancel()}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-description' : undefined}
        className="relative z-10 w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl animate-scale-in"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} className="text-red-400" strokeWidth={2} />
          </div>
          <div>
            <h2 id="confirm-dialog-title" className="text-sm font-bold text-zinc-100">
              {title}
            </h2>
            {description && (
              <p id="confirm-dialog-description" className="text-xs text-zinc-500 mt-1.5">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60',
              'text-zinc-300 bg-zinc-800 hover:bg-zinc-700'
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-70',
              'flex items-center justify-center gap-2 text-white bg-red-600 hover:bg-red-500'
            )}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
