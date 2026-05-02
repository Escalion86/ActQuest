import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import CabinetGameOrderPageClient from '@components/cabinet/app-router/CabinetGameOrderPageClient'
import { LOCATIONS } from '@server/serverConstants'

export const metadata = { title: 'ActQuest — Заказать игру' }

export const dynamic = 'force-dynamic'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  const normalized = value.trim().toLowerCase()
  return LOCATIONS?.[normalized] && !LOCATIONS[normalized]?.hidden
    ? normalized
    : ''
}

export default async function CabinetGameOrdersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/game-orders')}`,
    )
  }

  const locationOptions = Object.entries(LOCATIONS)
    .filter(([, value]) => !value?.hidden)
    .map(([key, value]) => ({
      value: key,
      label:
        typeof value?.townRu === 'string' && value.townRu
          ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
          : key,
    }))

  return (
    <CabinetGameOrderPageClient
      locationOptions={locationOptions}
      initialValues={{
        contactName: session.user.name || session.user.username || '',
        phone: session.user.phone ? String(session.user.phone) : '',
        email: session.user.email || '',
        telegram: session.user.username ? `@${session.user.username}` : '',
        location: normalizeLocation(session.user.location),
      }}
    />
  )
}
