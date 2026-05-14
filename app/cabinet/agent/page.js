import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import AgentGamesPageClient from '@components/cabinet/app-router/AgentGamesPageClient'

export const metadata = { title: 'ActQuest — Агент' }

export const dynamic = 'force-dynamic'

const canViewAgentCabinet = (role) =>
  ['agent', 'moder', 'admin', 'dev'].includes(
    typeof role === 'string' ? role.trim().toLowerCase() : '',
  )

export default async function AgentPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/agent')}`)
  }

  if (!canViewAgentCabinet(session.user.role)) {
    redirect('/cabinet')
  }

  return <AgentGamesPageClient />
}
