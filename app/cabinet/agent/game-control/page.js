import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import AgentGameControlPageClient from '@components/cabinet/app-router/AgentGameControlPageClient'

export const metadata = { title: 'ActQuest — Контроль агента' }

export const dynamic = 'force-dynamic'

const canViewAgentCabinet = (role) =>
  ['agent', 'moder', 'admin', 'dev'].includes(
    typeof role === 'string' ? role.trim().toLowerCase() : '',
  )

export default async function AgentGameControlPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent(
        '/cabinet/agent/game-control',
      )}`,
    )
  }

  if (!canViewAgentCabinet(session.user.role)) {
    redirect('/cabinet')
  }

  return <AgentGameControlPageClient />
}
