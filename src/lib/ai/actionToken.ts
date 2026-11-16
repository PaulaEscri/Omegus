// SOLO SERVIDOR. Tokens firmados para acciones propuestas por la IA.
//
// La IA nunca escribe en la base de datos: solo PROPONE. La propuesta viaja al
// navegador como tarjeta con un token firmado (HMAC-SHA256) que contiene la
// acción exacta, el usuario al que pertenece y una caducidad. Al pulsar
// "Confirmar", una server action verifica el token y ejecuta con la sesión del
// usuario (RLS). Un cliente no puede fabricar ni alterar una acción, y un
// token de un usuario no sirve para otro.
//
// La clave de firma se deriva de SUPABASE_SERVICE_ROLE_KEY (secreta, solo
// servidor): no hace falta otra variable de entorno.

import type { ConfirmActionKind } from './types'

export interface ActionPayload {
  kind: ConfirmActionKind
  uid: string // usuario propietario
  data: Record<string, unknown>
  exp: number // epoch ms
  nonce: string // uuid: también sirve de id idempotente al crear
}

const TTL_MS = 15 * 60 * 1000

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para firmar acciones')
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`omegus-ai-actions:v1:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function signAction(
  kind: ConfirmActionKind,
  uid: string,
  data: Record<string, unknown>
): Promise<string> {
  const payload: ActionPayload = {
    kind,
    uid,
    data,
    exp: Date.now() + TTL_MS,
    nonce: crypto.randomUUID(),
  }
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(body))
  return `${body}.${b64url(new Uint8Array(sig))}`
}

// Devuelve el payload si la firma es válida, no ha caducado y es del usuario.
export async function verifyAction(token: string, uid: string): Promise<ActionPayload | null> {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      fromB64url(sig) as BufferSource,
      new TextEncoder().encode(body)
    )
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as ActionPayload
    if (payload.uid !== uid || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
