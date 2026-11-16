// Tipos compartidos entre el route handler (/api/chat) y la UI del chat.
// Sin imports de servidor: se puede importar desde componentes 'use client'.

export type ChatRole = 'user' | 'assistant'

export interface ChatMessageInput {
  role: ChatRole
  content: string
}

// Campo que falta para completar un borrador de transacción
export type DraftField = 'category' | 'account' | 'destination_account'

// Tarjeta "falta un dato": chips de opciones + botón Omitir / usar por defecto
export interface NeedsInfoCard {
  kind: 'needs_info'
  field: DraftField
  title: string // p. ej. "¿Qué categoría?"
  summary: string // resumen corto del borrador
  options: string[]
}

export type ConfirmActionKind = 'create_transaction' | 'create_place' | 'delete_transaction'

// Tarjeta de confirmación: la IA PROPONE, el usuario CONFIRMA con un botón.
// `token` está firmado en servidor; solo con él se ejecuta la acción.
export interface ConfirmCard {
  kind: 'confirm'
  action: ConfirmActionKind
  title: string
  lines: { label: string; value: string }[]
  destructive?: boolean
  token: string
}

export type AiCard = NeedsInfoCard | ConfirmCard

// Eventos del stream NDJSON de POST /api/chat (uno por línea)
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'card'; card: AiCard }
  | { type: 'context'; text: string } // nota oculta que el cliente reenvía como contexto
  | { type: 'error'; message: string }
  | { type: 'done' }

export const MAX_MESSAGES = 16
export const MAX_MESSAGE_CHARS = 3000
