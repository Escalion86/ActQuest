import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import getTeamGameTaskState, {
  GAME_TASK_ERRORS,
} from '@server/getTeamGameTaskState'
import { authOptions } from '@server/auth/authOptions'

const normalizeString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const sessionUserId =
    session?.user?.globalUserId || session?.user?.id || session?.user?._id || null
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
  const { location, gameId, teamId, message } = body

  const normalizedLocation = normalizeString(location)
  const normalizedGameId = normalizeString(gameId)
  const normalizedTeamId = normalizeString(teamId)
  const sanitizedMessage = normalizeString(message)

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
