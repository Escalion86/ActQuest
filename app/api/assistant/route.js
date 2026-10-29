import { getServerSession } from 'next-auth'
import { authOptions } from '@server/auth/authOptions'
import { handleAssistant } from '@server/assistant/gateway.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Публичный FAQ; персональный read-only контекст — только по серверной сессии.
export async function POST(request) {
  return handleAssistant(request, { getSession: () => getServerSession(authOptions) })
}
