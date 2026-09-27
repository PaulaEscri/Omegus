import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ⚠️ Cliente con la Service Role Key: se salta RLS por completo.
// Solo se importa desde código de SERVIDOR (Server Actions / Route Handlers).
// Nunca lo importes desde un componente 'use client' ni expongas esta clave al navegador.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno'
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
