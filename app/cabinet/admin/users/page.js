import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { loadCabinetAppAdminUsers } from '@app/cabinet/_lib/adminUsersServerData'
import AdminUsersPageClient from '@components/cabinet/app-router/AdminUsersPageClient'

export const metadata = { title: 'ActQuest — Управление пользователями' }

export const dynamic = 'force-dynamic'

export default async function CabinetAdminUsersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/users')}`,
    )
  }

  if (!isUserAdmin({ role: session.user.role })) {
    redirect('/cabinet')
  }

  const data = await loadCabinetAppAdminUsers({ session, offset: 0, limit: 10 })

  return (
    <AdminUsersPageClient
      session={session}
      initialUsers={data.users}
      initialHasMore={data.hasMore}
      initialLocation={session.user.location ?? null}
    />
  )
}
