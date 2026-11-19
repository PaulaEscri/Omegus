// SOLO SERVIDOR. Motor de IA agnóstico: cualquier endpoint compatible con la API
// de OpenAI (Groq, Gemini en modo compatible, OpenRouter, Ollama, vLLM…).
// Cambiar de proveedor = cambiar variables de entorno, sin tocar código:
//
//   LLM_BASE_URL  p. ej. https://api.groq.com/openai/v1   |   http://localhost:11434/v1 (Ollama)
//   LLM_MODEL     p. ej. llama-3.3-70b-versatile          |   qwen2.5:7b
//   LLM_API_KEY   clave del proveedor (opcional con Ollama)
//   LLM_FALLBACK_MODEL  (opcional) modelo de respaldo si el principal está caído/saturado
//   LLM_REASONING_EFFORT  (opcional) none|low|medium|high — menos razonamiento = respuesta más rápida
//   AI_DAILY_LIMIT  peticiones/día por usuario (por defecto 100)
//
// El modelo DEBE soportar tool-calling (function calling).

import OpenAI from 'openai'

// Tiempos máximos (ms). Nada del flujo de IA puede quedarse colgado más de TOTAL.
export const LLM_IDLE_TIMEOUT_MS = 20_000 // sin recibir NADA del proveedor (ni cabeceras ni tokens)
export const LLM_TOTAL_TIMEOUT_MS = 55_000 // petición completa, incluidas las rondas de herramientas

export interface LLM {
  client: OpenAI
  model: string
  fallbackModel: string | null
  reasoningEffort: 'none' | 'low' | 'medium' | 'high' | null
}

export function isLLMConfigured(): boolean {
  return !!process.env.LLM_BASE_URL && !!process.env.LLM_MODEL
}

function parseEffort(v: string | undefined): LLM['reasoningEffort'] {
  const e = v?.trim().toLowerCase()
  return e === 'none' || e === 'low' || e === 'medium' || e === 'high' ? e : null
}

export function getLLM(): LLM | null {
  const baseURL = process.env.LLM_BASE_URL
  const model = process.env.LLM_MODEL
  if (!baseURL || !model) return null

  return {
    client: new OpenAI({
      baseURL,
      // El SDK exige una clave no vacía; servidores como Ollama la ignoran.
      apiKey: process.env.LLM_API_KEY || 'not-needed',
      // Sin reintentos ocultos del SDK: multiplicaban la espera (45 s × 3). Los reintentos
      // y el modelo de respaldo los gestiona /api/chat con tiempos acotados.
      maxRetries: 0,
      timeout: LLM_IDLE_TIMEOUT_MS,
    }),
    model,
    fallbackModel: process.env.LLM_FALLBACK_MODEL?.trim() || null,
    reasoningEffort: parseEffort(process.env.LLM_REASONING_EFFORT),
  }
}

export function getDailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100
}
