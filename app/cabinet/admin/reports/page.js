import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { loadCabinetAppAdminReports } from '@app/cabinet/_lib/adminReportsServerData'
import AdminReportsPageClient from '@components/cabinet/app-router/AdminReportsPageClient'

export const metadata = { title: 'ActQuest — Статистика и отчёты' }

export const dynamic = 'force-dynamic'

export default async function CabinetAdminReportsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/reports')}`,
    )
  }

  if (!isUserAdmin({ role: session.user.role })) {
    redirect('/cabinet')
  }

  const location =
    typeof session.user.location === 'string' ? session.user.location : null
  const initialReports = await loadCabinetAppAdminReports({ location })

  return (
    <AdminReportsPageClient
      session={session}
      initialReports={initialReports}
      initialLocation={location}
    />
  )
}
