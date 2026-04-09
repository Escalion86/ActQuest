import { notFound } from 'next/navigation'

import LegacyGameResultPage from '@app/[location]/game/result/[id]/page'
import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'
import fetchGame from '@server/fetchGame'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id
  if (typeof gameId !== 'string') return {}

  try {
    const { location } = await resolveGameLocationById(gameId)
    if (!location) return {}

    const game = await fetchGame(location, gameId)
    if (!game?.name) return {}

    const title = `Результаты: ${game.name}`
    const description = `Результаты автоквеста «${game.name}» — места команд, время прохождения, статистика.`

    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
    }
  } catch {
    return {}
  }
}

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
