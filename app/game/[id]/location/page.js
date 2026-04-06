import { notFound } from 'next/navigation'

import LegacyGameLocationPage from '@app/[location]/game/location/[id]/page'
import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'

export const dynamic = 'force-dynamic'

export default async function GameLocationPage({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id

  if (typeof gameId !== 'string') {
    notFound()
  }

  const { location } = await resolveGameLocationById(gameId)
  if (!location) {
    notFound()
  }

  return <LegacyGameLocationPage params={{ id: gameId, location }} />
}
