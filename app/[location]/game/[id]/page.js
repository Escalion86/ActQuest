import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyGameEntryRedirect({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id
  if (typeof gameId !== 'string' || !gameId.trim()) {
    redirect('/cabinet/games-upcoming')
  }

  redirect(`/game/${encodeURIComponent(gameId)}`)
}
