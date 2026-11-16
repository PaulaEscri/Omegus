// SOLO SERVIDOR. Motor de IA agnóstico: cualquier endpoint compatible con la API
// de OpenAI (Groq, Gemini en modo compatible, OpenRouter, Ollama, vLLM…).
// Cambiar de proveedor = cambiar variables de entorno, sin tocar código:
//
//   LLM_BASE_URL  p. ej. https://api.groq.com/openai/v1   |   http://localhost:11434/v1 (Ollama)
//   LLM_MODEL     p. ej. llama-3.3-70b-versatile          |   qwen2.5:7b
//   LLM_API_KEY   clave del proveedor (opcional con Ollama)
//   AI_DAILY_LIMIT  peticiones/día por usuario (por defecto 100)
//
// El modelo DEBE soportar tool-calling (function calling).

import OpenAI from 'openai'

export interface LLM {
  client: OpenAI
  model: string
}

export function isLLMConfigured(): boolean {
  return !!process.env.LLM_BASE_URL && !!process.env.LLM_MODEL
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
      maxRetries: 1,
      timeout: 45_000,
    }),
    model,
  }
}

export function getDailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100
}
