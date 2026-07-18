import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import getTeamGameTaskState from '@server/getTeamGameTaskState'
import GameTeamPageClient from '@components/location-game/GameTeamPageClient'
import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'

export const dynamic = 'force-dynamic'

export default async function GameTestRunPage({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id
  const testRunId = resolvedParams?.runId
  if (typeof gameId !== 'string' || typeof testRunId !== 'string') notFound()

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    const callbackUrl = `/game/${gameId}/test/${testRunId}`
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const { location } = await resolveGameLocationById(gameId)
  if (!location) notFound()

  const userId =
    session.user.globalUserId ||
    session.user.userId ||
    session.user._id ||
    session.user.id ||
    null
  const stateResult = await getTeamGameTaskState({
    location,
    gameId,
    teamId: testRunId,
    testRunId,
    telegramId: session.user.telegramId,
    userId,
  })

  if (!stateResult.success) {
    redirect('/cabinet/games-upcoming')
  }

  const data = stateResult.data
  return (
    <GameTeamPageClient
      session={session}
      location={location}
      game={data.game}
      team={data.team}
      status={data.status}
      isGameStarted={data.isGameStarted}
      isGameFinished={data.isGameFinished}
      result={data.result}
      taskHtml={data.taskHtml}
      taskDisplayHtml={data.taskDisplayHtml || ''}
      taskDisplayText={data.taskDisplayText || ''}
      taskDisplayTaskHtml={data.taskDisplayTaskHtml || ''}
      taskDisplayTaskText={data.taskDisplayTaskText || ''}
      taskDisplayClues={data.taskDisplayClues || []}
      taskDisplayMeta={data.taskDisplayMeta || null}
      taskState={data.taskState}
      captainActions={data.captainActions || null}
      postCompletionMessage={data.postCompletionMessage || ''}
      error={null}
      gameId={gameId}
      teamId={testRunId}
      testRunId={testRunId}
      shouldClearMessageParam={false}
    />
  )
}
