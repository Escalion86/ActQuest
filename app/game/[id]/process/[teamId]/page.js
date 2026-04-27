import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'

import getTeamGameTaskState, {
  GAME_TASK_ERRORS,
} from '@server/getTeamGameTaskState'
import { authOptions } from '@server/auth/authOptions'
import GameTeamPageClient from '@components/location-game/GameTeamPageClient'
import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'

export const dynamic = 'force-dynamic'

export default async function GameTeamPage({ params, searchParams }) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const gameIdParam = resolvedParams?.id
  const teamIdParam = resolvedParams?.teamId

  if (typeof gameIdParam !== 'string' || typeof teamIdParam !== 'string') {
    notFound()
  }

  const { location } = await resolveGameLocationById(gameIdParam)
  if (!location) {
    notFound()
  }

  const session = await getServerSession(authOptions)
  const callbackUrl = `/game/${gameIdParam}/process/${teamIdParam}`
  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const sessionUserId =
    session.user.globalUserId ||
    session.user.userId ||
    session.user._id ||
    session.user.id ||
    null

  const messageParam =
    typeof resolvedSearchParams?.message === 'string'
      ? resolvedSearchParams.message
      : undefined
  const sanitizedMessage =
    messageParam && messageParam !== 'undefined'
      ? messageParam.trim()
      : undefined
  const shouldClearMessageParam = Boolean(sanitizedMessage)

  let payload
  try {
    const stateResult = await getTeamGameTaskState({
      location,
      gameId: gameIdParam,
      teamId: teamIdParam,
      telegramId: session?.user?.telegramId,
      userId: sessionUserId,
      message: sanitizedMessage,
    })

    if (!stateResult.success) {
      const { errorCode } = stateResult

      if (
        errorCode === GAME_TASK_ERRORS.GAME_NOT_FOUND ||
        errorCode === GAME_TASK_ERRORS.TEAM_NOT_FOUND
      ) {
        notFound()
      }

      if (errorCode === GAME_TASK_ERRORS.TEAM_ACCESS_DENIED) {
        redirect(`/game/${gameIdParam}`)
      }

      if (errorCode === GAME_TASK_ERRORS.DB_CONNECTION_FAILED) {
        const fallbackGame = stateResult.game || null
        const fallbackTeam = stateResult.team || null
        const fallbackStatus =
          stateResult.status || fallbackGame?.status || 'active'
        const isGameStarted =
          stateResult.isGameStarted ?? fallbackStatus === 'started'
        const isGameFinished =
          stateResult.isGameFinished ?? fallbackStatus === 'finished'

        payload = {
          session,
          location,
          game: fallbackGame,
          team: fallbackTeam,
          status: fallbackStatus,
          isGameStarted,
          isGameFinished,
          result: null,
          taskHtml: '',
          taskDisplayHtml: '',
          taskDisplayText: '',
          taskDisplayTaskHtml: '',
          taskDisplayTaskText: '',
          taskDisplayClues: [],
          taskDisplayMeta: null,
          taskState: 'idle',
          postCompletionMessage: '',
          error: 'DB_CONNECTION_FAILED',
          gameId: gameIdParam,
          teamId: teamIdParam,
          shouldClearMessageParam,
        }
      } else {
        payload = {
          session,
          location,
          game: stateResult.game || null,
          team: stateResult.team || null,
          status: stateResult.status || 'active',
          isGameStarted: stateResult.isGameStarted ?? false,
          isGameFinished: stateResult.isGameFinished ?? false,
          result: null,
          taskHtml: '',
          taskDisplayHtml: '',
          taskDisplayText: '',
          taskDisplayTaskHtml: '',
          taskDisplayTaskText: '',
          taskDisplayClues: [],
          taskDisplayMeta: null,
          taskState: 'idle',
          postCompletionMessage: '',
          error: 'UNKNOWN_ERROR',
          gameId: gameIdParam,
          teamId: teamIdParam,
          shouldClearMessageParam,
        }
      }
    } else {
      const data = stateResult.data
      payload = {
        session,
        location,
        game: data.game,
        team: data.team,
        status: data.status,
        isGameStarted: data.isGameStarted,
        isGameFinished: data.isGameFinished,
        result: data.result,
        taskHtml: data.taskHtml,
        taskDisplayHtml: data.taskDisplayHtml || '',
        taskDisplayText: data.taskDisplayText || '',
        taskDisplayTaskHtml: data.taskDisplayTaskHtml || '',
        taskDisplayTaskText: data.taskDisplayTaskText || '',
        taskDisplayClues: Array.isArray(data.taskDisplayClues)
          ? data.taskDisplayClues
          : [],
        taskDisplayMeta:
          data.taskDisplayMeta && typeof data.taskDisplayMeta === 'object'
            ? data.taskDisplayMeta
            : null,
        taskState: data.taskState,
        postCompletionMessage: data.postCompletionMessage || '',
        error: null,
        gameId: gameIdParam,
        teamId: teamIdParam,
        shouldClearMessageParam,
      }
    }
  } catch (error) {
    console.error('Game team page error', error)
    payload = {
      session,
      location,
      game: null,
      team: null,
      status: 'active',
      isGameStarted: false,
      isGameFinished: false,
      result: null,
      taskHtml: '',
      taskDisplayHtml: '',
      taskDisplayText: '',
      taskDisplayTaskHtml: '',
      taskDisplayTaskText: '',
      taskDisplayClues: [],
      taskDisplayMeta: null,
      taskState: 'idle',
      postCompletionMessage: '',
      error: 'UNKNOWN_ERROR',
      gameId: gameIdParam,
      teamId: teamIdParam,
      shouldClearMessageParam,
    }
  }

  return <GameTeamPageClient {...payload} />
}
