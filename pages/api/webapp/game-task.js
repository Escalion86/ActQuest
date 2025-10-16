import { getServerSession } from 'next-auth/next'

import getTeamGameTaskState, {
  GAME_TASK_ERRORS,
} from '@server/getTeamGameTaskState'

import { authOptions } from '../auth/[...nextauth]'

const normalizeString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.telegramId) {
    return res
      .status(401)
      .json({ success: false, error: 'Необходимо войти через Telegram' })
  }

  const { location, gameId, teamId, message } = req.body || {}

  const normalizedLocation = normalizeString(location)
  const normalizedGameId = normalizeString(gameId)
  const normalizedTeamId = normalizeString(teamId)
  const sanitizedMessage = normalizeString(message)

  if (!normalizedLocation || !normalizedGameId || !normalizedTeamId) {
    return res
      .status(400)
      .json({ success: false, error: 'Не указаны необходимые параметры' })
  }

  try {
    const stateResult = await getTeamGameTaskState({
      location: normalizedLocation,
      gameId: normalizedGameId,
      teamId: normalizedTeamId,
      telegramId: session.user.telegramId,
      message: sanitizedMessage,
    })

    if (!stateResult.success) {
      const { errorCode } = stateResult

      if (
        errorCode === GAME_TASK_ERRORS.GAME_NOT_FOUND ||
        errorCode === GAME_TASK_ERRORS.TEAM_NOT_FOUND
      ) {
        return res
          .status(404)
          .json({ success: false, error: 'Игра или команда не найдены' })
      }

      if (errorCode === GAME_TASK_ERRORS.TEAM_ACCESS_DENIED) {
        return res
          .status(403)
          .json({ success: false, error: 'Вы не участвуете в этой команде' })
      }

      if (errorCode === GAME_TASK_ERRORS.DB_CONNECTION_FAILED) {
        return res
          .status(503)
          .json({ success: false, error: 'Нет подключения к базе данных' })
      }

      return res
        .status(500)
        .json({ success: false, error: 'Не удалось обновить задание' })
    }

    return res.status(200).json({ success: true, data: stateResult.data })
  } catch (error) {
    console.error('Failed to refresh game task state', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось обновить задание' })
  }
}
