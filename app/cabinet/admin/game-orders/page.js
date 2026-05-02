import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { loadCabinetAppAdminGameOrders } from '@app/cabinet/_lib/adminGameOrdersServerData'
import AdminGameOrdersPageClient from '@components/cabinet/app-router/AdminGameOrdersPageClient'

export const metadata = { title: 'ActQuest — Заявки на игры' }

export const dynamic = 'force-dynamic'

export default async function CabinetAdminGameOrdersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/game-orders')}`,
    )
  }

  if (!isUserAdmin({ role: session.user.role })) {
    redirect('/cabinet')
  }

  const data = await loadCabinetAppAdminGameOrders({ offset: 0, limit: 20 })

  return (
    <AdminGameOrdersPageClient
      session={session}
      initialOrders={data.orders}
      initialHasMore={data.hasMore}
    />
  )
}
