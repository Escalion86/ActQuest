import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import GameTaskPreviewPageClient from '@components/cabinet/app-router/GameTaskPreviewPageClient'

export const metadata = { title: 'ActQuest — Предпросмотр задания' }
export const dynamic = 'force-dynamic'

export default async function GameTaskPreviewPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/task-preview')}`,
    )
  }

  return <GameTaskPreviewPageClient />
}
