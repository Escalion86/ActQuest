import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import GamesPageClient from '@components/cabinet/app-router/GamesPageClient'

export const metadata = { title: 'ActQuest — Прошедшие игры' }

export const dynamic = 'force-dynamic'

export default async function CabinetGamesPastPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/games-past')}`,
    )
  }

  return (
    <GamesPageClient
      session={session}
      initialGames={[]}
      initialHasMore={false}
      initialLocation={session?.user?.location ?? null}
      forcedView="past"
      availableModerators={[]}
    />
  )
}
