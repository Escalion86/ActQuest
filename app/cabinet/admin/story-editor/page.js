import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import StoryEditorPageClient from '@components/cabinet/app-router/StoryEditorPageClient'

export const metadata = { title: 'ActQuest — Story-редактор' }
export const dynamic = 'force-dynamic'

const isAllowedRole = (role) => {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : ''
  return normalized === 'dev' || normalized === 'admin' || normalized === 'moder'
}

export default async function StoryEditorPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/story-editor')}`,
    )
  }

  if (!isAllowedRole(session.user.role)) {
    redirect('/cabinet')
  }

  return <StoryEditorPageClient session={session} />
}
