import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import AdminPageClient from '@components/cabinet/app-router/AdminPageClient'

export const metadata = { title: 'ActQuest — Администрирование' }

export const dynamic = 'force-dynamic'

export default async function CabinetAdminPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin')}`)
  }

  if (!isUserAdmin({ role: session.user.role })) {
    redirect('/cabinet')
  }

  return <AdminPageClient session={session} />
}
