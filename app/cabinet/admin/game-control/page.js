import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import GameControlPageClient from '@components/cabinet/app-router/GameControlPageClient'

export const metadata = { title: 'ActQuest — Контроль игры' }

export const dynamic = 'force-dynamic'

export default async function GameControlPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/admin/game-control')}`,
    )
  }

  return <GameControlPageClient session={session} />
}
