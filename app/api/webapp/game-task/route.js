import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import getTeamGameTaskState, {
  GAME_TASK_ERRORS,
} from '@server/getTeamGameTaskState'
import { authOptions } from '@server/auth/authOptions'

const isGameTaskDebugEnabled =
  process.env.GAME_TASK_DEBUG === '1' || process.env.SESSION_DEBUG === '1'

const gameTaskDebugLog = (stage, payload = null) => {
  if (!isGameTaskDebugEnabled) {
    return
  }

  const time = new Date().toISOString()
  if (payload === null || payload === undefined) {
    console.info(`[game-task-debug] ${time} ${stage}`)
    return
  }

  console.info(`[game-task-debug] ${time} ${stage}`, payload)
}

const normalizeString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const sessionUserId =
    session?.user?.globalUserId ||
    session?.user?.userId ||
    session?.user?._id ||
    session?.user?.id ||
    null
  const sessionTelegramId =
    session?.user?.telegramId !== null && session?.user?.telegramId !== undefined
      ? Number(session.user.telegramId)
      : null

  if (!sessionUserId && !Number.isFinite(sessionTelegramId)) {
    return NextResponse.json(
      { success: false, error: 'Необходимо войти в аккаунт' },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => ({}))) || {}
  const { location, gameId, teamId, message, action, testRunId } = body

  const normalizedLocation = normalizeString(location)
  const normalizedGameId = normalizeString(gameId)
  const normalizedTeamId = normalizeString(teamId)
  const sanitizedMessage = normalizeString(message)
  const normalizedAction = normalizeString(action)
  const normalizedTestRunId = normalizeString(testRunId)

  gameTaskDebugLog('request_received', {
    sessionUserId: sessionUserId ? String(sessionUserId) : null,
    sessionTelegramId:
      Number.isFinite(sessionTelegramId) ? String(sessionTelegramId) : null,
    location: normalizedLocation,
    gameId: normalizedGameId,
    teamId: normalizedTeamId,
    action: normalizedAction,
    testRunId: normalizedTestRunId,
  })

  if (!normalizedLocation || !normalizedGameId || !normalizedTeamId) {
    return NextResponse.json(
      { success: false, error: 'Не указаны необходимые параметры' },
      { status: 400 },
    )
  }

  try {
    const stateResult = await getTeamGameTaskState({
      location: normalizedLocation,
      gameId: normalizedGameId,
      teamId: normalizedTeamId,
      telegramId: Number.isFinite(sessionTelegramId) ? sessionTelegramId : null,
      userId: sessionUserId,
      message: sanitizedMessage,
      action: normalizedAction,
      testRunId: normalizedTestRunId,
    })

    if (!stateResult.success) {
      const { errorCode } = stateResult

      if (
        errorCode === GAME_TASK_ERRORS.GAME_NOT_FOUND ||
        errorCode === GAME_TASK_ERRORS.TEAM_NOT_FOUND
      ) {
        return NextResponse.json(
          { success: false, error: 'Игра или команда не найдены' },
          { status: 404 },
        )
      }

      if (errorCode === GAME_TASK_ERRORS.TEAM_ACCESS_DENIED) {
        return NextResponse.json(
          { success: false, error: 'Вы не участвуете в этой команде' },
          { status: 403 },
        )
      }

      if (errorCode === GAME_TASK_ERRORS.DB_CONNECTION_FAILED) {
        return NextResponse.json(
          { success: false, error: 'Нет подключения к базе данных' },
          { status: 503 },
        )
      }

      return NextResponse.json(
        { success: false, error: 'Не удалось обновить задание' },
        { status: 500 },
      )
    }

    gameTaskDebugLog('response_ready', {
      sessionUserId: sessionUserId ? String(sessionUserId) : null,
      sessionTelegramId:
        Number.isFinite(sessionTelegramId) ? String(sessionTelegramId) : null,
      gameId: normalizedGameId,
      teamId: normalizedTeamId,
      taskState: stateResult?.data?.taskState ?? null,
      canFinishBreak:
        stateResult?.data?.captainActions?.canFinishBreak ?? null,
      canForceClue: stateResult?.data?.captainActions?.canForceClue ?? null,
      canFailTask: stateResult?.data?.captainActions?.canFailTask ?? null,
    })

    return NextResponse.json(
      { success: true, data: stateResult.data },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to refresh game task state', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить задание' },
      { status: 500 },
    )
  }
}
