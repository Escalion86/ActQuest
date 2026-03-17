import { getServerSession } from 'next-auth/next'

import dbConnectGlobal from '@utils/dbConnectGlobal'

import { authOptions } from '../auth/[...nextauth]'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const { gameTeamId: rawGameTeamId, location: rawLocation } = req.query || {}
  const gameTeamId = Array.isArray(rawGameTeamId)
    ? rawGameTeamId[0]
    : rawGameTeamId

  if (!gameTeamId || typeof gameTeamId !== 'string') {
    return res
      .status(400)
      .json({ success: false, error: 'Не указан идентификатор команды игры' })
  }

  const normalizedPreferredLocation =
    normalizeLocation(rawLocation) || normalizeLocation(session.user?.location)

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: 'Глобальная база недоступна' })
    }

    const foundGameTeam = await db.model('GamesTeams').findById(gameTeamId).lean()
    if (!foundGameTeam) {
      return res
        .status(404)
        .json({ success: false, error: 'Команда не найдена в игре' })
    }

    const gameId = foundGameTeam.gameId ? String(foundGameTeam.gameId) : null
    const teamId = foundGameTeam.teamId ? String(foundGameTeam.teamId) : null

    if (!gameId) {
      return res
        .status(404)
        .json({ success: false, error: 'Игра не найдена для указанной команды' })
    }

    const gameDoc = await db
      .model('Games')
      .findById(gameId)
      .select({ _id: 1, location: 1 })
      .lean()
    const gameLocation = normalizeLocation(gameDoc?.location)
    const resolvedLocation = gameLocation || normalizedPreferredLocation || null

    if (
      normalizedPreferredLocation &&
      resolvedLocation &&
      normalizedPreferredLocation !== resolvedLocation
    ) {
      return res
        .status(403)
        .json({ success: false, error: 'Команда игры не относится к выбранной площадке' })
    }

    return res.status(200).json({
      success: true,
      gameTeam: {
        id: String(foundGameTeam._id),
        gameId,
        teamId,
        location: resolvedLocation || '',
      },
    })
  } catch (error) {
    console.error('Failed to load game team info', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось получить данные команды игры' })
  }
}
