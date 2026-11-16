// POST /api/chat — asistente financiero (streaming NDJSON).
//
// Seguridad:
//  - Requiere sesión (cookie de Supabase). Sin sesión → 401 JSON.
//  - Todo acceso a datos usa el cliente Supabase del usuario (RLS); el modelo solo
//    dispone de las herramientas de src/lib/ai/tools.ts (sin SQL, sin service role).
//  - El cliente solo puede enviar mensajes `user`/`assistant` (texto): no puede
//    inyectar `system` ni `tool`.
//  - Las escrituras NO ocurren aquí: el modelo propone y el usuario confirma con
//    un botón (server action confirmAiAction + token firmado).
//  - Cuota diaria por usuario (ai_usage).

import { z } from 'zod'
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { getLLM } from '@/lib/ai/config'
import { loadCatalog, type Db } from '@/lib/ai/domain'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { TOOLS, runTool, serializeResult } from '@/lib/ai/tools'
import { checkAndCountUsage } from '@/lib/ai/usage'
import { MAX_MESSAGES, MAX_MESSAGE_CHARS, type StreamEvent } from '@/lib/ai/types'

export const dynamic = 'force-dynamic'

const MAX_TOOL_ROUNDS = 5

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1)
    .max(MAX_MESSAGES),
})

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: Request) {
  // Defensa CSRF adicional: si el navegador envía Origin, debe ser el mismo host
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ error: 'forbidden' }, 403)
    } catch {
      return json({ error: 'forbidden' }, 403)
    }
  }

  const user = await getSessionUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  let parsedBody: z.infer<typeof bodySchema>
  try {
    parsedBody = bodySchema.parse(await req.json())
  } catch {
    return json({ error: 'Petición no válida' }, 400)
  }
  if (parsedBody.messages[parsedBody.messages.length - 1].role !== 'user') {
    return json({ error: 'Petición no válida' }, 400)
  }

  const llm = getLLM()
  if (!llm) return json({ error: 'El asistente no está configurado todavía' }, 503)

  const db = (await createClient()) as unknown as Db

  const usage = await checkAndCountUsage(db, user.id)
  if (!usage.allowed) {
    return json({ error: `Has alcanzado el límite diario (${usage.limit} mensajes). Vuelve mañana.` }, 429)
  }

  const catalog = await loadCatalog(db)
  const ctx = { db, userId: user.id, catalog }

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(catalog) },
    ...parsedBody.messages.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'))
      const contexts: string[] = []

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const completion = await llm.client.chat.completions.create(
            {
              model: llm.model,
              messages,
              tools: TOOLS,
              tool_choice: 'auto',
              temperature: 0.3,
              stream: true,
            },
            { signal: req.signal }
          )

          let text = ''
          const calls = new Map<number, { id: string; name: string; args: string }>()

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta
            if (!delta) continue
            if (delta.content) {
              text += delta.content
              send({ type: 'text', delta: delta.content })
            }
            for (const tc of delta.tool_calls ?? []) {
              // Algunos proveedores (p. ej. Gemini en modo compatible) omiten `index`:
              // un fragmento con nombre abre una llamada nueva; el resto continúa la última.
              const idx =
                typeof tc.index === 'number'
                  ? tc.index
                  : tc.function?.name
                    ? calls.size
                    : Math.max(calls.size - 1, 0)
              const cur = calls.get(idx) ?? { id: '', name: '', args: '' }
              if (tc.id) cur.id = tc.id
              if (tc.function?.name) cur.name += tc.function.name
              if (tc.function?.arguments) cur.args += tc.function.arguments
              calls.set(idx, cur)
            }
          }

          if (calls.size === 0) break // respuesta final

          const toolCalls = [...calls.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([i, c]) => ({
              id: c.id || `call_${round}_${i}`,
              type: 'function' as const,
              function: { name: c.name, arguments: c.args || '{}' },
            })) satisfies ChatCompletionMessageToolCall[]

          messages.push({ role: 'assistant', content: text || null, tool_calls: toolCalls })

          for (const call of toolCalls) {
            let args: unknown = {}
            try {
              args = JSON.parse(call.function.arguments)
            } catch {
              /* argumentos mal formados: runTool devolverá error de validación */
            }
            const out = await runTool(call.function.name, args, ctx)
            if (out.card) send({ type: 'card', card: out.card })
            if (out.context) contexts.push(out.context)
            messages.push({ role: 'tool', tool_call_id: call.id, content: serializeResult(out.result) })
          }
        }

        for (const c of contexts) send({ type: 'context', text: c })
        send({ type: 'done' })
      } catch (err: unknown) {
        if (req.signal.aborted) {
          controller.close()
          return
        }
        const status = (err as { status?: number })?.status
        // Detalle técnico solo en los logs del Worker (sin contenido del usuario)
        console.error(
          '[ai] chat error:',
          status ?? 'sin-estado',
          (err as Error)?.message,
          JSON.stringify((err as { error?: unknown })?.error ?? null).slice(0, 800)
        )
        send({
          type: 'error',
          message:
            status === 429
              ? 'El servicio de IA está saturado. Inténtalo en un minuto.'
              : status === 404
                ? 'El modelo de IA configurado ya no está disponible. Hay que actualizar LLM_MODEL.'
                : status === 401 || status === 403
                ? 'La configuración del asistente no es válida.'
                : `No he podido responder (error ${status ?? 'de conexión'} del proveedor de IA). Inténtalo de nuevo.`,
        })
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
