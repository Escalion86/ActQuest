import { notFound } from 'next/navigation'

import LegacyGameResultPage from '@app/[location]/game/result/[id]/page'
import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'

export const dynamic = 'force-dynamic'

export default async function GameResultPage({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id

  if (typeof gameId !== 'string') {
    notFound()
  }

  const { location } = await resolveGameLocationById(gameId)
  if (!location) {
    notFound()
  }

  return <LegacyGameResultPage params={{ id: gameId, location }} />
}
