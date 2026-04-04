import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'

import getTeamGameTaskState, {
  GAME_TASK_ERRORS,
} from '@server/getTeamGameTaskState'
import { authOptions } from '@server/auth/authOptions'
import GameTeamPageClient from '@components/location-game/GameTeamPageClient'

export const dynamic = 'force-dynamic'

export default async function GameTeamPage({ params, searchParams }) {
  const locationParam = params?.location
  const gameIdParam = params?.id
  const teamIdParam = params?.teamId

  if (
    typeof locationParam !== 'string' ||
    typeof gameIdParam !== 'string' ||
    typeof teamIdParam !== 'string'
  ) {
    notFound()
  }

  const session = await getServerSession(authOptions)
  const callbackUrl = `/${locationParam}/game/${gameIdParam}/${teamIdParam}`
  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const messageParam =
    typeof searchParams?.message === 'string' ? searchParams.message : undefined
  const sanitizedMessage =
    messageParam && messageParam !== 'undefined' ? messageParam.trim() : undefined
  const shouldClearMessageParam = Boolean(sanitizedMessage)

  let payload
  try {
    const stateResult = await getTeamGameTaskState({
      location: locationParam,
      gameId: gameIdParam,
      teamId: teamIdParam,
      telegramId: session?.user?.telegramId,
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
        redirect(`/${locationParam}/game/${gameIdParam}`)
      }

      if (errorCode === GAME_TASK_ERRORS.DB_CONNECTION_FAILED) {
        const fallbackGame = stateResult.game || null
        const fallbackTeam = stateResult.team || null
        const fallbackStatus = stateResult.status || fallbackGame?.status || 'active'
        const isGameStarted = stateResult.isGameStarted ?? fallbackStatus === 'started'
        const isGameFinished = stateResult.isGameFinished ?? fallbackStatus === 'finished'

        payload = {
          session,
          location: locationParam,
          game: fallbackGame,
          team: fallbackTeam,
          status: fallbackStatus,
          isGameStarted,
          isGameFinished,
          result: null,
          taskHtml: '',
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
          location: locationParam,
          game: stateResult.game || null,
          team: stateResult.team || null,
          status: stateResult.status || 'active',
          isGameStarted: stateResult.isGameStarted ?? false,
          isGameFinished: stateResult.isGameFinished ?? false,
          result: null,
          taskHtml: '',
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
        location: locationParam,
        game: data.game,
        team: data.team,
        status: data.status,
        isGameStarted: data.isGameStarted,
        isGameFinished: data.isGameFinished,
        result: data.result,
        taskHtml: data.taskHtml,
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
      location: locationParam,
      game: null,
      team: null,
      status: 'active',
      isGameStarted: false,
      isGameFinished: false,
      result: null,
      taskHtml: '',
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
