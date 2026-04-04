import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { loadCabinetAppTeams } from '@app/cabinet/_lib/teamsServerData'
import TeamsPageClient from '@components/cabinet/app-router/TeamsPageClient'

export const metadata = { title: 'ActQuest — Мои команды' }

export const dynamic = 'force-dynamic'

export default async function CabinetTeamsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/teams')}`)
  }

  const initialTeams = await loadCabinetAppTeams(session)

  return (
    <TeamsPageClient
      session={session}
      initialTeams={initialTeams}
      initialLocation={session?.user?.location ?? null}
    />
  )
}
