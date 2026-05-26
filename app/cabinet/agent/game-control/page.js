import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'

export const metadata = { title: 'ActQuest — Контроль агента' }

export const dynamic = 'force-dynamic'

export default async function AgentGameControlPage({ searchParams }) {
  const session = await getServerSession(authOptions)
  const resolvedSearchParams = await searchParams
  const gameId =
    typeof resolvedSearchParams?.gameId === 'string'
      ? resolvedSearchParams.gameId.trim()
      : ''
  const targetPath = gameId
    ? `/cabinet/agent?gameId=${encodeURIComponent(gameId)}`
    : '/cabinet/agent'

  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent(targetPath)}`)
  }

  redirect(targetPath)
}
