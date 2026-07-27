import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import AdminGameReviewsPageClient from '@components/cabinet/app-router/AdminGameReviewsPageClient'

export const metadata = { title: 'ActQuest — Отзывы об играх' }
export const dynamic = 'force-dynamic'

export default async function CabinetAdminReviewsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/reviews')}`,
    )
  }
  if (!isUserAdmin({ role: session.user.role })) {
    redirect('/cabinet')
  }

  return <AdminGameReviewsPageClient session={session} />
}
