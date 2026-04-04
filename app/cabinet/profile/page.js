import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { loadCabinetAppProfile } from '@app/cabinet/_lib/profileServerData'
import ProfilePageClient from '@components/cabinet/app-router/ProfilePageClient'

export const metadata = { title: 'ActQuest — Мой профиль' }

export const dynamic = 'force-dynamic'

export default async function CabinetProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/profile')}`)
  }

  const initialProfile = await loadCabinetAppProfile(session)

  return <ProfilePageClient initialProfile={initialProfile} />
}
