// SOLO SERVIDOR. Herramientas (function calling) que el modelo puede invocar.
// Son la ÚNICA vía de acceso a los datos: el modelo no ve SQL ni ids de usuario.
//  - Lectura: get_summary, list_transactions, list_places, get_budgets, get_portfolio
//  - Propuestas (NO escriben): propose_transaction, propose_place, propose_delete_transaction
// Todo se ejecuta con el cliente Supabase del usuario (RLS).

import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { z } from 'zod'
import {
  getBudgets,
  getPortfolio,
  getSummary,
  listPlaces,
  listTransactions,
  proposeDelete,
  proposePlace,
  proposeTransaction,
  type Catalog,
  type Db,
} from './domain'
import type { AiCard } from './types'

export interface ToolContext {
  db: Db
  userId: string
  catalog: Catalog
}

export interface ToolOutput {
  result: unknown // lo que ve el modelo
  card?: AiCard // lo que ve el usuario (UI estructurada)
  context?: string // nota oculta que el cliente reenvía en el siguiente turno
}

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const period = z.enum(['this_month', 'last_month', 'this_week', 'last_30_days', 'this_year', 'all'])
const txType = z.enum(['income', 'expense', 'savings'])

const schemas = {
  get_summary: z.object({ period: period.optional(), date_from: iso.optional(), date_to: iso.optional() }),
  list_transactions: z.object({
    period: period.optional(),
    date_from: iso.optional(),
    date_to: iso.optional(),
    type: txType.optional(),
    category: z.string().max(80).optional(),
    text: z.string().max(80).optional(),
    min_amount: z.number().optional(),
    max_amount: z.number().optional(),
    limit: z.number().int().optional(),
  }),
  list_places: z.object({ text: z.string().max(80).optional() }),
  get_budgets: z.object({}),
  get_portfolio: z.object({}),
  propose_transaction: z.object({
    type: txType,
    amount: z.number(),
    concept: z.string().max(120).optional(),
    category: z.string().max(80).optional(),
    account: z.string().max(80).optional(),
    destination_account: z.string().max(80).optional(),
    date: iso.optional(),
    notes: z.string().max(500).optional(),
    place: z.string().max(120).optional(),
    ticker: z.string().max(15).optional(),
    quantity: z.number().optional(),
    use_defaults: z.boolean().optional(),
  }),
  propose_place: z.object({ name: z.string().max(120), address: z.string().max(300).optional() }),
  propose_delete_transaction: z.object({ id: z.string() }),
}

type ToolName = keyof typeof schemas

const periodProp = {
  type: 'string',
  enum: ['this_month', 'last_month', 'this_week', 'last_30_days', 'this_year', 'all'],
  description: 'Periodo predefinido. Por defecto: this_month.',
}
const dateProp = (d: string) => ({ type: 'string', description: `${d} (YYYY-MM-DD)` })

const fn = (name: string, description: string, properties: object, required: string[] = []): ChatCompletionTool => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
})

export const TOOLS: ChatCompletionTool[] = [
  fn('get_summary', 'Totales de ingresos, gastos y ahorro de un periodo, y las categorías con más gasto.', {
    period: periodProp,
    date_from: dateProp('Inicio personalizado'),
    date_to: dateProp('Fin personalizado'),
  }),
  fn(
    'list_transactions',
    'Lista movimientos (máx. 25) con su id. Úsala para consultas concretas y para localizar un movimiento antes de borrarlo.',
    {
      period: periodProp,
      date_from: dateProp('Inicio'),
      date_to: dateProp('Fin'),
      type: { type: 'string', enum: ['income', 'expense', 'savings'] },
      category: { type: 'string', description: 'Nombre de categoría o subcategoría' },
      text: { type: 'string', description: 'Texto contenido en el concepto' },
      min_amount: { type: 'number' },
      max_amount: { type: 'number' },
      limit: { type: 'integer', description: 'Máximo 25' },
    }
  ),
  fn('list_places', 'Lista los lugares guardados por el usuario.', { text: { type: 'string' } }),
  fn('get_budgets', 'Presupuestos activos con lo gastado y lo que queda en el periodo actual.', {}),
  fn('get_portfolio', 'Resumen de la cartera de inversión (lo invertido por activo).', {}),
  fn(
    'propose_transaction',
    'PROPONE registrar un ingreso, gasto o ahorro. NO guarda: el usuario debe confirmarlo con un botón. Si falta categoría o cuenta, la herramienta lo pedirá al usuario con botones.',
    {
      type: { type: 'string', enum: ['income', 'expense', 'savings'] },
      amount: { type: 'number', description: 'Importe positivo en euros' },
      concept: { type: 'string', description: 'Descripción corta, p. ej. "Cena en La Tagliatella"' },
      category: { type: 'string', description: 'Categoría o subcategoría si se deduce; si no, omítela' },
      account: { type: 'string', description: 'Cuenta si el usuario la indica; si no, omítela' },
      destination_account: { type: 'string', description: 'Solo para ahorro/inversión' },
      date: dateProp('Fecha; omítela para hoy'),
      notes: { type: 'string' },
      place: { type: 'string', description: 'Nombre del lugar, si se menciona' },
      ticker: { type: 'string', description: 'Solo inversiones: símbolo bursátil' },
      quantity: { type: 'number', description: 'Solo inversiones: nº de unidades' },
      use_defaults: {
        type: 'boolean',
        description: 'true SOLO si el usuario ha pedido omitir / usar valores por defecto',
      },
    },
    ['type', 'amount']
  ),
  fn(
    'propose_place',
    'PROPONE añadir un lugar (comercio, restaurante…). NO guarda: requiere confirmación del usuario.',
    { name: { type: 'string' }, address: { type: 'string' } },
    ['name']
  ),
  fn(
    'propose_delete_transaction',
    'PROPONE borrar UN movimiento por su id exacto (de list_transactions). NO borra: se pide confirmación al usuario.',
    { id: { type: 'string', description: 'Id exacto devuelto por list_transactions' } },
    ['id']
  ),
]

const MAX_RESULT_CHARS = 6000

export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolOutput> {
  if (!(name in schemas)) return { result: { error: `Herramienta desconocida: ${name}` } }
  const tool = name as ToolName

  const parsed = schemas[tool].safeParse(rawArgs ?? {})
  if (!parsed.success) {
    return { result: { error: 'Argumentos no válidos', detail: parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).slice(0, 4) } }
  }
  // Ya validado con zod arriba; el switch pasa cada forma concreta a su función
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = parsed.data as any

  try {
    switch (tool) {
      case 'get_summary':
        return { result: await getSummary(ctx.db, ctx.catalog, a) }
      case 'list_transactions':
        return { result: await listTransactions(ctx.db, ctx.catalog, a) }
      case 'list_places':
        return { result: await listPlaces(ctx.db, a) }
      case 'get_budgets':
        return { result: await getBudgets(ctx.db, ctx.catalog) }
      case 'get_portfolio':
        return { result: await getPortfolio(ctx.db) }
      case 'propose_transaction':
      case 'propose_place':
      case 'propose_delete_transaction': {
        const out =
          tool === 'propose_transaction'
            ? await proposeTransaction(ctx.db, ctx.userId, ctx.catalog, a)
            : tool === 'propose_place'
              ? await proposePlace(ctx.db, ctx.userId, a)
              : await proposeDelete(ctx.db, ctx.userId, ctx.catalog, a)
        if (out.status === 'error') return { result: out.result }
        return { result: out.result, card: out.card, context: out.context }
      }
    }
  } catch (err) {
    console.error(`[ai] tool ${name}:`, err)
    return { result: { error: 'No se pudo completar la consulta' } }
  }
}

// Resultado → texto para el modelo, acotado
export function serializeResult(result: unknown): string {
  const s = JSON.stringify(result)
  return s.length > MAX_RESULT_CHARS ? s.slice(0, MAX_RESULT_CHARS) + '…[truncado]' : s
}
