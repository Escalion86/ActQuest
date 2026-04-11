import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { loadCabinetAppGames } from '@app/cabinet/_lib/gamesServerData'
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

  const initialGames = await loadCabinetAppGames({
    session,
    view: 'past',
  })

  return (
    <GamesPageClient
      session={session}
      initialGames={initialGames}
      initialHasMore={Array.isArray(initialGames) && initialGames.length >= 10}
      initialLocation={session?.user?.location ?? null}
      forcedView="past"
      availableModerators={[]}
    />
  )
}
