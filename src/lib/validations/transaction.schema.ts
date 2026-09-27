import { z } from 'zod'

// ── Schema principal de transacción ─────────────────────────
export const transactionSchema = z
  .object({
    type: z.enum(['income', 'expense', 'savings'], {
      required_error: 'Selecciona el tipo de transacción',
    }),

    amount: z
      .number({
        required_error: 'Introduce un importe',
        invalid_type_error: 'El importe debe ser un número',
      })
      .positive({ message: 'El importe debe ser mayor que 0' })
      .max(999_999_99, { message: 'Importe demasiado elevado' }),

    currency: z.string().default('EUR'),

    category_id: z
      .string({ required_error: 'Selecciona una categoría' })
      .uuid({ message: 'Categoría inválida' }),

    subcategory_id: z.string().uuid().optional().or(z.literal('')),

    account_id: z
      .string({ required_error: 'Selecciona una cuenta' })
      .uuid({ message: 'Cuenta inválida' }),

    // Solo requerido cuando type = 'savings'
    destination_account_id: z.string().uuid().optional().or(z.literal('')),

    concept: z
      .string()
      .max(120, { message: 'Máximo 120 caracteres' })
      .optional()
      .or(z.literal('')),

    notes: z
      .string()
      .max(500, { message: 'Máximo 500 caracteres' })
      .optional()
      .or(z.literal('')),

    transaction_date: z.date({
      required_error: 'Selecciona una fecha',
      invalid_type_error: 'Fecha inválida',
    }),

    is_recurring: z.boolean().default(false),

    tags: z.array(z.string()).default([]),
  })
  // Validación cruzada: savings requiere cuenta destino
  .refine(
    (data) => {
      if (data.type === 'savings') {
        return !!data.destination_account_id && data.destination_account_id !== ''
      }
      return true
    },
    {
      message: 'Selecciona la cuenta destino (broker/inversión)',
      path: ['destination_account_id'],
    }
  )
  // Validación: cuenta origen ≠ cuenta destino en savings
  .refine(
    (data) => {
      if (data.type === 'savings' && data.destination_account_id) {
        return data.account_id !== data.destination_account_id
      }
      return true
    },
    {
      message: 'La cuenta origen y destino no pueden ser la misma',
      path: ['destination_account_id'],
    }
  )
  // Validación: savings requiere concept (nombre del activo)
  .refine(
    (data) => {
      if (data.type === 'savings') {
        return !!data.concept && data.concept.trim().length >= 2
      }
      return true
    },
    {
      message: 'Introduce el nombre del activo/ticker (min. 2 caracteres)',
      path: ['concept'],
    }
  )

export type TransactionSchema = z.infer<typeof transactionSchema>
export type TransactionFormInput = z.input<typeof transactionSchema>

// ── Schema para valores por defecto del formulario ──────────
export const transactionDefaultValues: Partial<TransactionSchema> = {
  type: 'expense',
  currency: 'EUR',
  transaction_date: new Date(),
  is_recurring: false,
  tags: [],
  subcategory_id: '',
  destination_account_id: '',
  concept: '',
  notes: '',
}
