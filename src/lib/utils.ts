import type { TransactionType } from '@/types/database'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(dateStr + 'T00:00:00'))
}

export function formatDateLong(dateStr: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00'))
}

// ── Rango de fechas de un mes (usa hora local, no UTC) ───────
// date-fns `format` lee los componentes locales del Date, evitando el
// desfase de un día que produce Date.toISOString() en husos horarios
// adelantados a UTC (España, UTC+1/+2).
export function getMonthRange(date: Date): { from: string; to: string } {
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  }
}

export function getCurrentMonthRange(): { from: string; to: string } {
  return getMonthRange(new Date())
}

export function getLastMonthRange(): { from: string; to: string } {
  const now = new Date()
  return getMonthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1))
}

export const TRANSACTION_COLORS: Record<TransactionType, string> = {
  income: '#22c55e',
  expense: '#ef4444',
  savings: '#3b82f6',
}

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  savings: 'Ahorro / Inversión',
}

export const CONCEPT_SUGGESTIONS: Record<string, string[]> = {
  // Alimentación
  supermercado: ['Mercadona', 'Lidl', 'Carrefour', 'Día', 'Alcampo', 'El Corte Inglés'],
  restaurantes: ['Restaurante', 'Bar', 'Tapas', 'Menú del día'],
  delivery: ['Glovo', 'Uber Eats', 'Just Eat', 'Dominos'],
  // Transporte
  gasolina: ['Gasolinera', 'BP', 'Repsol', 'Cepsa'],
  transporte_publico: ['Metro', 'Bus', 'Renfe', 'EMT', 'Abono transporte'],
  taxi: ['Uber', 'Cabify', 'FreeNow', 'Taxi'],
  // Vivienda
  suministros: ['Luz', 'Agua', 'Gas', 'Internet', 'Endesa', 'Naturgy', 'Iberdrola'],
  // Ocio
  streaming: ['Netflix', 'Spotify', 'HBO Max', 'Disney+', 'Apple TV+', 'Amazon Prime'],
  // Salud
  salud: ['Farmacia', 'Médico', 'Dentista', 'Óptica', 'Gimnasio'],
  // Ingresos
  salario: ['Nómina', 'Salario', 'Pago empresa'],
  cashback: ['Cashback tarjeta', 'Intereses Trade Republic', 'Dividendo', 'Referido'],
}
