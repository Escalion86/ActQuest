import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import StoryEditorPageClient from '@components/cabinet/app-router/StoryEditorPageClient'

export const metadata = { title: 'ActQuest — Story-редактор' }
export const dynamic = 'force-dynamic'

export default async function StoryEditorPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/story-editor')}`,
    )
  }

  return <StoryEditorPageClient session={session} />
}
