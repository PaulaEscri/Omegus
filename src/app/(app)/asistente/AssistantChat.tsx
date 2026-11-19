'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Square, Sparkles, Check, X, Loader2, AlertCircle } from 'lucide-react'
import { BASE_PATH } from '@/lib/basePath'
import { cn } from '@/lib/utils'
import { confirmAiAction } from './actions'
import {
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  type AiCard,
  type ChatMessageInput,
  type ConfirmCard,
  type NeedsInfoCard,
  type StreamEvent,
} from '@/lib/ai/types'

// ── Tipos de UI ──────────────────────────────────────────────
type CardStatus = 'idle' | 'working' | 'done' | 'cancelled' | 'error'
interface CardState {
  card: AiCard
  status: CardStatus
  message?: string
}
interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  cards: CardState[]
  context: string[] // notas ocultas que se reenvían a la IA como contexto
  streaming?: boolean
  error?: string
}

const uid = () => Math.random().toString(36).slice(2, 10)

const SUGGESTIONS = [
  '¿Cuánto he gastado este mes?',
  'Resumen de la semana',
  '12€ comida en Mercadona',
  '¿Cómo voy con los presupuestos?',
]

// Historial que se envía al servidor: texto visible + notas de contexto
function buildHistory(messages: UiMessage[]): ChatMessageInput[] {
  return messages
    .map((m) => ({
      role: m.role,
      content: [m.text, ...m.context].filter(Boolean).join('\n').slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-MAX_MESSAGES)
}

// ── Viewport visual (teclado de iOS) ─────────────────────────
// Safari no encoge el viewport de layout con el teclado: medimos el
// visualViewport y anclamos el chat a la zona realmente visible.
function useVisualViewport() {
  const [vp, setVp] = useState<{ height: number; top: number; keyboard: boolean } | null>(null)
  useEffect(() => {
    const v = window.visualViewport
    if (!v) return
    const update = () =>
      setVp({ height: v.height, top: v.offsetTop, keyboard: window.innerHeight - v.height > 120 })
    update()
    v.addEventListener('resize', update)
    v.addEventListener('scroll', update)
    return () => {
      v.removeEventListener('resize', update)
      v.removeEventListener('scroll', update)
    }
  }, [])
  return vp
}

// Tiempos del cliente (el servidor corta antes: 20 s de inactividad / 55 s en total)
const CLIENT_IDLE_MS = 30_000
const CLIENT_TOTAL_MS = 70_000

// ── Componente principal ─────────────────────────────────────
export function AssistantChat({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const vp = useVisualViewport()

  // Autoscroll dentro de la lista (no de la página)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, vp?.height])

  // Textarea autoajustable (máx. ~5 líneas)
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`
  }, [input])

  const patch = useCallback((id: string, fn: (m: UiMessage) => UiMessage) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)))
  }, [])

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text || busy || !configured) return

      const userMsg: UiMessage = { id: uid(), role: 'user', text, cards: [], context: [] }
      const asstId = uid()
      const history = buildHistory([...messages, userMsg])

      setMessages((ms) => [
        ...ms,
        userMsg,
        { id: asstId, role: 'assistant', text: '', cards: [], context: [], streaming: true },
      ])
      setInput('')
      setBusy(true)

      const ctrl = new AbortController()
      abortRef.current = ctrl

      // Red de seguridad en el cliente: si el servidor no da señales de vida (ni
      // texto ni errores) en IDLE_MS, o la respuesta supera TOTAL_MS, se corta y
      // se avisa. Así `busy` nunca se queda activado.
      let timedOut: 'idle' | 'total' | null = null
      let idleTimer: ReturnType<typeof setTimeout> | undefined
      const armIdle = () => {
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          timedOut = 'idle'
          ctrl.abort()
        }, CLIENT_IDLE_MS)
      }
      const totalTimer = setTimeout(() => {
        timedOut = 'total'
        ctrl.abort()
      }, CLIENT_TOTAL_MS)
      let finished = false // llegó el evento 'done' o 'error' del servidor
      armIdle()

      try {
        const res = await fetch(`${BASE_PATH}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: ctrl.signal,
        })

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null)
          throw new Error(
            res.status === 401
              ? 'Sesión caducada. Recarga la página.'
              : (data?.error ?? `El servidor respondió con error ${res.status}. Inténtalo de nuevo.`)
          )
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const handle = (ev: StreamEvent) => {
          if (ev.type === 'text') patch(asstId, (m) => ({ ...m, text: m.text + ev.delta }))
          else if (ev.type === 'card')
            patch(asstId, (m) => ({ ...m, cards: [...m.cards, { card: ev.card, status: 'idle' }] }))
          else if (ev.type === 'context') patch(asstId, (m) => ({ ...m, context: [...m.context, ev.text] }))
          else if (ev.type === 'error') patch(asstId, (m) => ({ ...m, error: ev.message }))
          if (ev.type === 'done' || ev.type === 'error') finished = true
        }

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          armIdle()
          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line) continue
            try {
              handle(JSON.parse(line) as StreamEvent)
            } catch {
              /* línea incompleta/ruido: se ignora */
            }
          }
        }
        // El stream terminó sin 'done' ni 'error': conexión cortada a mitad de respuesta
        if (!finished) {
          patch(asstId, (m) => ({
            ...m,
            error: m.error ?? 'La conexión se cortó antes de terminar la respuesta. Inténtalo de nuevo.',
          }))
        }
      } catch (err) {
        const name = (err as Error)?.name
        let message: string
        if (name === 'AbortError') {
          // Parada manual del usuario: sin error. Si fue un corte por tiempo, se explica.
          message =
            timedOut === 'idle'
              ? `El asistente no ha dado señales de vida en ${CLIENT_IDLE_MS / 1000} s. Inténtalo de nuevo.`
              : timedOut === 'total'
                ? `El asistente ha tardado más de ${CLIENT_TOTAL_MS / 1000} s. Inténtalo con una pregunta más corta.`
                : ''
        } else if (err instanceof TypeError) {
          message = `Sin conexión con el servidor (${err.message}). Revisa tu red e inténtalo de nuevo.`
        } else {
          message = (err as Error)?.message || 'No he podido responder.'
        }
        if (message) patch(asstId, (m) => ({ ...m, error: message }))
      } finally {
        clearTimeout(idleTimer)
        clearTimeout(totalTimer)
        patch(asstId, (m) => ({ ...m, streaming: false }))
        setBusy(false)
        abortRef.current = null
      }
    },
    [busy, configured, messages, patch]
  )

  const stop = () => abortRef.current?.abort()

  // Confirmar / cancelar una tarjeta
  const setCard = (msgId: string, idx: number, next: Partial<CardState>) =>
    patch(msgId, (m) => ({ ...m, cards: m.cards.map((c, i) => (i === idx ? { ...c, ...next } : c)) }))

  const confirm = async (msgId: string, idx: number, card: ConfirmCard) => {
    setCard(msgId, idx, { status: 'working' })
    const res = await confirmAiAction(card.token)
    setCard(msgId, idx, { status: res.ok ? 'done' : 'error', message: res.message })
    setMessages((ms) => [
      ...ms,
      {
        id: uid(),
        role: 'assistant',
        text: res.ok ? `✅ ${res.message}` : `⚠️ ${res.message}`,
        cards: [],
        context: [res.ok ? `[Confirmado por el usuario: ${res.message}]` : `[Falló la acción: ${res.message}]`],
      },
    ])
  }

  const cancel = (msgId: string, idx: number) => {
    setCard(msgId, idx, { status: 'cancelled' })
    setMessages((ms) => [
      ...ms,
      { id: uid(), role: 'assistant', text: 'Cancelado.', cards: [], context: ['[El usuario canceló la propuesta.]'] },
    ])
  }

  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // En escritorio Enter envía; en móvil Enter = salto de línea (se envía con el botón)
    if (e.key === 'Enter' && !e.shiftKey && !isTouch) {
      e.preventDefault()
      void send(input)
    }
  }

  const lastId = messages[messages.length - 1]?.id
  const keyboard = vp?.keyboard ?? false

  return (
    <div
      className="fixed inset-x-0 z-40 flex flex-col bg-zinc-950"
      style={{ top: vp?.top ?? 0, height: vp ? `${vp.height}px` : '100dvh' }}
    >
      {/* Cabecera */}
      <header
        className="shrink-0 border-b border-zinc-800/50 bg-zinc-950/90 px-5 pb-3 backdrop-blur-xl"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15">
            <Sparkles size={18} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-zinc-50">Asistente</h1>
            <p className="text-[11px] text-zinc-500">Pregunta, registra y revisa tus finanzas</p>
          </div>
        </div>
      </header>

      {/* Mensajes */}
      <div
        ref={listRef}
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {!configured && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              El asistente aún no está disponible. Vuelve a intentarlo más tarde.
            </div>
          )}

          {configured && messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 pt-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
                <Sparkles size={26} className="text-violet-400" />
              </div>
              <p className="max-w-[260px] text-sm text-zinc-400">
                Escríbeme un gasto (“24€ cena en La Tagliatella”) o pregúntame por tus números.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="min-h-11 rounded-full border border-zinc-800 bg-zinc-900/70 px-3.5 py-2 text-xs text-zinc-300 active:scale-95"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            if (m.role === 'assistant' && !m.text && m.cards.length === 0 && !m.streaming && !m.error) return null
            return (
              <div key={m.id} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
                {(m.text || m.streaming || m.error) && (
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'rounded-br-md bg-violet-600 text-white'
                        : 'rounded-bl-md border border-zinc-800 bg-zinc-900 text-zinc-200'
                    )}
                  >
                    {m.text}
                    {m.streaming && !m.text && (
                      <span className="inline-flex items-center gap-1 text-zinc-500">
                        <Loader2 size={14} className="animate-spin" /> Pensando…
                      </span>
                    )}
                    {m.error && (
                      <span className="flex items-center gap-1.5 text-red-400">
                        <AlertCircle size={14} /> {m.error}
                      </span>
                    )}
                  </div>
                )}

                {m.cards.map((cs, idx) =>
                  cs.card.kind === 'confirm' ? (
                    <ConfirmCardView
                      key={idx}
                      state={cs}
                      onConfirm={() => void confirm(m.id, idx, cs.card as ConfirmCard)}
                      onCancel={() => cancel(m.id, idx)}
                    />
                  ) : (
                    <NeedsInfoView
                      key={idx}
                      card={cs.card as NeedsInfoCard}
                      active={m.id === lastId && !busy}
                      onChoose={(txt) => void send(txt)}
                    />
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="shrink-0 border-t border-zinc-800/60 bg-zinc-950 px-4 pt-2.5"
        style={{
          // Con el teclado cerrado, deja sitio a la barra de navegación inferior
          // (4.5rem) y al botón central que sobresale 1.25rem por encima de ella
          paddingBottom: keyboard
            ? '0.625rem'
            : 'calc(5.875rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex max-w-md items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={1000}
            placeholder={configured ? 'Escribe un mensaje…' : 'Asistente no disponible'}
            disabled={!configured}
            enterKeyHint="send"
            autoComplete="off"
            aria-label="Mensaje para el asistente"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500/60 disabled:opacity-50"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Detener"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-200 active:scale-95"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !configured}
              aria-label="Enviar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white transition active:scale-95 disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

// ── Tarjeta de confirmación (crear / borrar) ─────────────────
function ConfirmCardView({
  state,
  onConfirm,
  onCancel,
}: {
  state: CardState
  onConfirm: () => void
  onCancel: () => void
}) {
  const card = state.card as ConfirmCard
  const finished = state.status === 'done' || state.status === 'cancelled'
  return (
    <div
      className={cn(
        'w-full max-w-[92%] rounded-2xl border p-4',
        card.destructive ? 'border-red-500/30 bg-red-500/5' : 'border-violet-500/25 bg-zinc-900'
      )}
    >
      <p className={cn('mb-2.5 text-sm font-semibold', card.destructive ? 'text-red-300' : 'text-zinc-100')}>
        {card.title}
      </p>
      <dl className="space-y-1.5">
        {card.lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3 text-xs">
            <dt className="shrink-0 text-zinc-500">{l.label}</dt>
            <dd className="text-right font-medium text-zinc-200">{l.value}</dd>
          </div>
        ))}
      </dl>

      {state.status === 'done' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <Check size={14} /> Hecho
        </p>
      )}
      {state.status === 'cancelled' && <p className="mt-3 text-xs text-zinc-500">Cancelado</p>}
      {state.status === 'error' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={14} /> {state.message}
        </p>
      )}

      {!finished && (
        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={state.status === 'working'}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-300 active:scale-95 disabled:opacity-50"
          >
            <X size={16} /> Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={state.status === 'working'}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white active:scale-95 disabled:opacity-60',
              card.destructive ? 'bg-red-600' : 'bg-violet-600'
            )}
          >
            {state.status === 'working' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {card.destructive ? 'Sí, borrar' : 'Confirmar'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta "falta un dato": chips + Omitir ──────────────────
function NeedsInfoView({
  card,
  active,
  onChoose,
}: {
  card: NeedsInfoCard
  active: boolean
  onChoose: (text: string) => void
}) {
  const label = card.field === 'category' ? 'Categoría' : card.field === 'account' ? 'Cuenta' : 'Cuenta destino'
  return (
    <div className={cn('w-full max-w-[92%] rounded-2xl border border-zinc-800 bg-zinc-900 p-4', !active && 'opacity-50')}>
      <p className="text-xs text-zinc-500">{card.summary}</p>
      <p className="mb-3 mt-1 text-sm font-semibold text-zinc-100">{card.title}</p>
      <div className="flex flex-wrap gap-2">
        {card.options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={!active}
            onClick={() => onChoose(`${label}: ${o}`)}
            className="min-h-11 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-200 active:scale-95 disabled:pointer-events-none"
          >
            {o}
          </button>
        ))}
        <button
          type="button"
          disabled={!active}
          onClick={() => onChoose('Omitir, usa los valores por defecto')}
          className="min-h-11 rounded-full border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 active:scale-95 disabled:pointer-events-none"
        >
          Omitir / usar por defecto
        </button>
      </div>
    </div>
  )
}
