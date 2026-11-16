import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { isLLMConfigured } from '@/lib/ai/config'
import { AssistantChat } from './AssistantChat'

export const metadata: Metadata = {
  title: 'Asistente · Finanzas',
  description: 'Asistente financiero: consulta, registra y revisa tus movimientos.',
}

export const dynamic = 'force-dynamic'

export default async function AsistentePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return <AssistantChat configured={isLLMConfigured()} />
}
