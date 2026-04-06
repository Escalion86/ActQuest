import { notFound } from 'next/navigation'

import LegacyGameMapPage from '@app/[location]/game/map/[id]/[teamId]/page'
import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'

export const dynamic = 'force-dynamic'

export default async function GameMapPage({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id
  const teamId = resolvedParams?.teamId

  if (typeof gameId !== 'string' || typeof teamId !== 'string') {
    notFound()
  }

  const { location } = await resolveGameLocationById(gameId)
  if (!location) {
    notFound()
  }

  return <LegacyGameMapPage params={{ id: gameId, teamId, location }} />
}
