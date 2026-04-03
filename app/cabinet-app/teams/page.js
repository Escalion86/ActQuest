import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import CabinetTeamsPilotPage from '@components/cabinet/app-pilot/CabinetTeamsPilotPage'
import { loadCabinetAppTeams } from '@app/cabinet-app/_lib/teamsServerData'

export const dynamic = 'force-dynamic'

export default async function CabinetAppTeamsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet-app/teams')}`)
  }

  const teams = await loadCabinetAppTeams(session)

  return <CabinetTeamsPilotPage teams={teams} />
}
