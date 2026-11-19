// GET /api/bank/aspsps — bancos disponibles en España (Enable Banking).
import { describeEbError, listAspsps } from '@/lib/bank/enableBanking'
import { bankJson, requireBankUser } from '@/lib/bank/guard'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireBankUser(req)
  if (auth instanceof Response) return auth

  try {
    const list = await listAspsps('ES')
    const aspsps = list
      .map((a) => ({ name: a.name, country: a.country }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return Response.json({ aspsps }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch (err) {
    console.error('[bank] aspsps:', err)
    return bankJson({ error: describeEbError(err) }, 502)
  }
}
