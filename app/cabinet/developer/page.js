import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import DeveloperPageClient from '@components/cabinet/app-router/DeveloperPageClient'

export const metadata = { title: 'ActQuest — Разработчик' }

export const dynamic = 'force-dynamic'

export default async function CabinetDeveloperPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/developer')}`,
    )
  }

  return <DeveloperPageClient session={session} />
}
