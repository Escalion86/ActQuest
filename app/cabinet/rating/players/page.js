import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { loadCabinetRating } from '@app/cabinet/_lib/ratingServerData'
import RatingPageClient from '@components/cabinet/app-router/RatingPageClient'

export const metadata = { title: 'ActQuest — Рейтинг игроков' }
export const dynamic = 'force-dynamic'

export default async function CabinetPlayersRatingPage({ searchParams }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(
      `/cabinet/login?callbackUrl=${encodeURIComponent('/cabinet/rating/players')}`,
    )
  }

  const resolvedSearchParams = await searchParams
  const data = await loadCabinetRating({
    session,
    type: 'players',
    seasonId: resolvedSearchParams?.season,
  })

  return (
    <RatingPageClient
      type="players"
      top={data.top}
      personal={data.personal}
      cityName={data.cityName}
      seasons={data.seasons}
      selectedSeasonId={data.selectedSeasonId}
    />
  )
}
