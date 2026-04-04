import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import CabinetDashboardPageClient from '@components/cabinet/app-router/CabinetDashboardPageClient'
import { loadCabinetAppOverview } from '@app/cabinet/_lib/overviewServerData'

export const metadata = { title: 'ActQuest — Обзор' }

export const dynamic = 'force-dynamic'

export default async function CabinetOverviewPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet')}`)
  }

  const overviewData = await loadCabinetAppOverview(session)

  return (
    <CabinetDashboardPageClient
      session={session}
      dashboardData={overviewData}
    />
  )
}
