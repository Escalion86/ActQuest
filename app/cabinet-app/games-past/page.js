import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import CabinetGamesPilotPage from '@components/cabinet/app-pilot/CabinetGamesPilotPage'
import { loadCabinetAppGames } from '@app/cabinet-app/_lib/gamesServerData'

export const dynamic = 'force-dynamic'

export default async function CabinetAppPastGamesPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet-app/games-past')}`,
    )
  }

  const games = await loadCabinetAppGames({ session, view: 'past' })

  return (
    <CabinetGamesPilotPage
      title="Прошедшие игры"
      games={games}
      pagesPath="/cabinet/games-past"
      pagesLinkLabel="Открыть текущую pages-версию"
      emptyLabel="В выбранной локации пока нет прошедших игр."
    />
  )
}
