import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { loadCabinetAppAdminTeams } from '@app/cabinet/_lib/adminTeamsServerData'
import AdminTeamsPageClient from '@components/cabinet/app-router/AdminTeamsPageClient'

export const metadata = { title: 'ActQuest — Управление командами' }

export const dynamic = 'force-dynamic'

export default async function CabinetAdminTeamsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/teams')}`,
    )
  }

  if (!isUserAdmin({ role: session.user.role })) {
    redirect('/cabinet')
  }

  const data = await loadCabinetAppAdminTeams({ session, offset: 0, limit: 10 })

  return (
    <AdminTeamsPageClient
      session={session}
      initialTeams={data.teams}
      initialHasMore={data.hasMore}
      initialLocation={session.user.location ?? null}
    />
  )
}
