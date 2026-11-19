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
//
// Tiempos: cada llamada al proveedor se aborta si pasa LLM_IDLE_TIMEOUT_MS sin
// recibir nada, y toda la petición tiene un tope de LLM_TOTAL_TIMEOUT_MS. Al fallar
// se avisa al usuario con el motivo real (estado HTTP, modelo y mensaje del proveedor).

import { z } from 'zod'
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { getLLM, LLM_IDLE_TIMEOUT_MS, LLM_TOTAL_TIMEOUT_MS } from '@/lib/ai/config'
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

// Estados transitorios en los que merece la pena probar otro modelo / reintentar
const isTransient = (status: number | undefined) =>
  status === 404 || status === 408 || status === 429 || (typeof status === 'number' && status >= 500)

// Quita claves/tokens que pudiera citar el proveedor y recorta el mensaje
function sanitize(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[clave]')
    .replace(/(sk|gsk|key)[-_][0-9A-Za-z_-]{16,}/gi, '[clave]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [oculto]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}

function describeError(err: unknown, model: string, timeout: 'idle' | 'total' | null): string {
  if (timeout === 'total') {
    return `La IA ha tardado más de ${LLM_TOTAL_TIMEOUT_MS / 1000} s en responder (modelo ${model}). Inténtalo con una pregunta más corta.`
  }
  const e = err as { status?: number; message?: string; name?: string; code?: string }
  const status = e?.status
  const raw = sanitize(e?.message ?? '')
  const detail = raw ? ` Detalle: ${raw}` : ''

  if (timeout === 'idle' || e?.name === 'APIConnectionTimeoutError') {
    return `El proveedor de IA no ha respondido en ${LLM_IDLE_TIMEOUT_MS / 1000} s (modelo ${model}). Inténtalo de nuevo.`
  }
  if (status === 404) {
    return `El modelo «${model}» no existe o ya no está disponible (404). Revisa LLM_MODEL en Cloudflare.${detail}`
  }
  if (status === 429) {
    return `Cuota o límite de peticiones del proveedor de IA agotado (429, modelo ${model}). Espera un minuto o revisa la cuota de la API key.${detail}`
  }
  if (status === 401 || status === 403) {
    return `El proveedor rechaza la API key (${status}). Revisa LLM_API_KEY en Cloudflare.${detail}`
  }
  if (status === 400) {
    return `El proveedor ha rechazado la petición (400, modelo ${model}).${detail}`
  }
  if (typeof status === 'number' && status >= 500) {
    return `El proveedor de IA está caído o sobrecargado (${status}, modelo ${model}). Inténtalo en unos segundos.${detail}`
  }
  if (e?.name === 'APIConnectionError' || status === undefined) {
    return `No se pudo conectar con el proveedor de IA (revisa LLM_BASE_URL).${detail}`
  }
  return `Error ${status} del proveedor de IA (modelo ${model}).${detail}`
}

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
  if (!llm) {
    return json(
      { error: 'El asistente no está configurado: faltan LLM_BASE_URL o LLM_MODEL en Cloudflare.' },
      503
    )
  }

  let db: Db
  let catalog: Awaited<ReturnType<typeof loadCatalog>>
  try {
    db = (await createClient()) as unknown as Db
    // Cuota y catálogo son independientes: en paralelo
    const [usage, cat] = await Promise.all([checkAndCountUsage(db, user.id), loadCatalog(db)])
    if (!usage.allowed) {
      return json({ error: `Has alcanzado el límite diario (${usage.limit} mensajes). Vuelve mañana.` }, 429)
    }
    catalog = cat
  } catch (err) {
    console.error('[ai] preparación:', err)
    return json({ error: `No se pudieron cargar tus datos para el asistente. ${sanitize((err as Error)?.message ?? '')}` }, 500)
  }
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

      // ── Control de tiempos ────────────────────────────────
      // `current` es el AbortController de la llamada en curso. Un temporizador de
      // inactividad se rearma con cada dato recibido; otro, global, corta todo.
      let current: AbortController | null = null
      const t = { kind: null as 'idle' | 'total' | null } // objeto: TS no estrecha lo que cambian los temporizadores
      let idleTimer: ReturnType<typeof setTimeout> | undefined
      const abortCurrent = () => current?.abort()
      const armIdle = () => {
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          t.kind = t.kind ?? 'idle'
          abortCurrent()
        }, LLM_IDLE_TIMEOUT_MS)
      }
      const totalTimer = setTimeout(() => {
        t.kind = 'total'
        abortCurrent()
      }, LLM_TOTAL_TIMEOUT_MS)
      req.signal.addEventListener('abort', abortCurrent)
      const cleanup = () => {
        clearTimeout(idleTimer)
        clearTimeout(totalTimer)
        req.signal.removeEventListener('abort', abortCurrent)
      }

      const createStream = (model: string) => {
        current = new AbortController()
        armIdle()
        return llm.client.chat.completions.create(
          {
            model,
            messages,
            tools: TOOLS,
            tool_choice: 'auto',
            temperature: 0.3,
            stream: true,
            ...(llm.reasoningEffort ? { reasoning_effort: llm.reasoningEffort } : {}),
          },
          { signal: current.signal }
        )
      }

      let activeModel = llm.model
      let produced = false // ¿se envió algún texto o tarjeta al usuario?

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          // Intentos: principal → respaldo (o el mismo modelo una vez más si no hay respaldo)
          const models = [llm.model, llm.fallbackModel ?? llm.model]
          let completion: Awaited<ReturnType<typeof createStream>> | undefined
          let lastErr: unknown
          for (let i = 0; i < models.length; i++) {
            activeModel = models[i]
            try {
              completion = await createStream(activeModel)
              break
            } catch (e) {
              lastErr = e
              const st = (e as { status?: number })?.status
              const timedOutIdle = t.kind === 'idle'
              if (req.signal.aborted || t.kind === 'total') throw e
              if (!(isTransient(st) || timedOutIdle || st === undefined) || i === models.length - 1) throw e
              console.error('[ai] intento fallido:', activeModel, st ?? (timedOutIdle ? 'idle-timeout' : 'red'))
              t.kind = null // el temporizador de inactividad no debe contaminar el siguiente intento
            }
          }
          if (!completion) throw lastErr

          let text = ''
          let finish: string | null = null
          const calls = new Map<number, { id: string; name: string; args: string }>()

          for await (const chunk of completion) {
            armIdle()
            const choice = chunk.choices[0]
            if (choice?.finish_reason) finish = choice.finish_reason
            const delta = choice?.delta
            if (!delta) continue
            if (delta.content) {
              text += delta.content
              produced = true
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
          clearTimeout(idleTimer) // las herramientas no cuentan como inactividad del proveedor

          if (calls.size === 0) {
            if (!produced) {
              // Respuesta vacía: sin esto el usuario vería una burbuja en blanco
              throw Object.assign(new Error(`respuesta vacía (finish_reason: ${finish ?? 'ninguno'})`), {
                emptyResponse: true,
              })
            }
            break // respuesta final
          }

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
            if (out.card) {
              produced = true
              send({ type: 'card', card: out.card })
            }
            if (out.context) contexts.push(out.context)
            messages.push({ role: 'tool', tool_call_id: call.id, content: serializeResult(out.result) })
          }
        }

        for (const c of contexts) send({ type: 'context', text: c })
        send({ type: 'done' })
      } catch (err: unknown) {
        if (req.signal.aborted) {
          cleanup()
          controller.close()
          return
        }
        const e = err as { status?: number; message?: string; emptyResponse?: boolean }
        // Detalle técnico solo en los logs del Worker (sin contenido del usuario)
        console.error(
          '[ai] chat error:',
          activeModel,
          e?.status ?? t.kind ?? 'sin-estado',
          e?.message,
          JSON.stringify((err as { error?: unknown })?.error ?? null).slice(0, 800)
        )
        send({
          type: 'error',
          message: e?.emptyResponse
            ? `El modelo «${activeModel}» no ha devuelto ninguna respuesta (${sanitize(e.message ?? '')}). Reformula la pregunta.`
            : describeError(err, activeModel, t.kind),
        })
      }
      cleanup()
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
