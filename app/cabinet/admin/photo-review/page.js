import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import PhotoReviewPageClient from '@components/cabinet/app-router/PhotoReviewPageClient'

export const metadata = { title: 'ActQuest - Проверка фотоквеста' }

export const dynamic = 'force-dynamic'

const canOpenPhotoReview = (role) =>
  role === 'admin' || role === 'dev' || role === 'moder'

export default async function PhotoReviewPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/photo-review')}`,
    )
  }

  if (!canOpenPhotoReview(session.user.role)) {
    redirect('/cabinet')
  }

  return <PhotoReviewPageClient session={session} />
}
