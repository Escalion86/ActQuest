import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import CabinetProfilePilotPage from '@components/cabinet/app-pilot/CabinetProfilePilotPage'
import { loadCabinetAppProfile } from '@app/cabinet-app/_lib/profileServerData'

export const dynamic = 'force-dynamic'

export default async function CabinetAppProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet-app/profile')}`,
    )
  }

  const profile = await loadCabinetAppProfile(session)

  return <CabinetProfilePilotPage profile={profile} />
}
