import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import AgentGameControlPageClient from '@components/cabinet/app-router/AgentGameControlPageClient'
import AgentGamesPageClient from '@components/cabinet/app-router/AgentGamesPageClient'

export const metadata = { title: 'ActQuest — Агент' }

export const dynamic = 'force-dynamic'

export default async function AgentPage({ searchParams }) {
  const session = await getServerSession(authOptions)
  const resolvedSearchParams = await searchParams
  const gameId =
    typeof resolvedSearchParams?.gameId === 'string'
      ? resolvedSearchParams.gameId.trim()
      : ''

  if (!session?.user) {
    const callbackUrl = gameId
      ? `/cabinet/agent?gameId=${encodeURIComponent(gameId)}`
      : '/cabinet/agent'
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return gameId ? <AgentGameControlPageClient /> : <AgentGamesPageClient />
}
