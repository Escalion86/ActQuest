import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import PhotoReviewPageClient from '@components/cabinet/app-router/PhotoReviewPageClient'

export const metadata = { title: 'ActQuest - Проверка фотоквеста' }

export const dynamic = 'force-dynamic'

export default async function PhotoReviewPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/photo-review')}`,
    )
  }

  return <PhotoReviewPageClient session={session} />
}
