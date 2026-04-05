import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { loadCabinetAppAdminEvents } from '@app/cabinet/_lib/adminEventsServerData'
import AdminEventsPageClient from '@components/cabinet/app-router/AdminEventsPageClient'

export const metadata = { title: 'ActQuest — События сайта' }

export const dynamic = 'force-dynamic'

export default async function CabinetAdminEventsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/events')}`,
    )
  }

  if (!isUserAdmin({ role: session.user.role })) {
    redirect('/cabinet')
  }

  const data = await loadCabinetAppAdminEvents({ offset: 0, limit: 20 })

  return (
    <AdminEventsPageClient
      session={session}
      initialEvents={data.events}
      initialHasMore={data.hasMore}
    />
  )
}
