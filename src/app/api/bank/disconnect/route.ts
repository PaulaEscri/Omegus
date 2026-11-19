// POST /api/bank/disconnect — revoca la sesión en Enable Banking y borra la conexión.
// Body: { connectionId: string }. Los movimientos ya importados se conservan.
import { deleteSession } from '@/lib/bank/enableBanking'
import { bankJson, requireBankUser } from '@/lib/bank/guard'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireBankUser(req, { write: true })
  if (auth instanceof Response) return auth

  let connectionId = ''
  try {
    const body = await req.json()
    connectionId = typeof body?.connectionId === 'string' ? body.connectionId : ''
  } catch {
    /* body vacío */
  }
  if (!connectionId) return bankJson({ error: 'Petición no válida' }, 400)

  const { data: row } = await auth.db
    .from('bank_connections')
    .select('session_id')
    .eq('id', connectionId)
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (!row) return bankJson({ error: 'La conexión no existe.' }, 404)

  const sessionId = (row as { session_id: string }).session_id

  // Revocar en el banco es "best effort": si ya caducó, igualmente se borra aquí
  try {
    await deleteSession(sessionId)
  } catch (err) {
    console.error('[bank] revocar sesión:', (err as Error)?.message)
  }

  const { error } = await auth.db
    .from('bank_connections')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', auth.userId)
  if (error) {
    console.error('[bank] borrar conexión:', error.message)
    return bankJson({ error: 'No se pudo desconectar. Inténtalo de nuevo.' }, 500)
  }
  return bankJson({ ok: true })
}
