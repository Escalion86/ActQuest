import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyGameProcessRedirect({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id
  const teamId = resolvedParams?.teamId

  if (
    typeof gameId !== 'string' ||
    !gameId.trim() ||
    typeof teamId !== 'string' ||
    !teamId.trim()
  ) {
    redirect('/cabinet/games-upcoming')
  }

  redirect(
    `/game/${encodeURIComponent(gameId)}/process/${encodeURIComponent(teamId)}`,
  )
}
