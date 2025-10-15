import { getServerSession } from 'next-auth/next'

import dbConnect from '@utils/dbConnect'

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

  const location =
    normalizeLocation(rawLocation) || normalizeLocation(session.user?.location)

  if (!location) {
    return res
      .status(400)
      .json({ success: false, error: 'Не удалось определить игровую площадку' })
  }

  try {
    const db = await dbConnect(location)

    if (!db) {
      return res
        .status(400)
        .json({ success: false, error: 'Указана неизвестная игровая площадка' })
    }

    const gameTeam = await db.model('GamesTeams').findById(gameTeamId).lean()

    if (!gameTeam) {
      return res
        .status(404)
        .json({ success: false, error: 'Команда не найдена в игре' })
    }

    const gameId = gameTeam.gameId ? String(gameTeam.gameId) : null
    const teamId = gameTeam.teamId ? String(gameTeam.teamId) : null

    if (!gameId) {
      return res
        .status(404)
        .json({ success: false, error: 'Игра не найдена для указанной команды' })
    }

    return res.status(200).json({
      success: true,
      gameTeam: {
        id: String(gameTeam._id),
        gameId,
        teamId,
      },
    })
  } catch (error) {
    console.error('Failed to load game team info', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось получить данные команды игры' })
  }
}
