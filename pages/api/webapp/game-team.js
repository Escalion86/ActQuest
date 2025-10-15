import { getServerSession } from 'next-auth/next'

import dbConnect from '@utils/dbConnect'

import { LOCATIONS } from '@server/serverConstants'

import { authOptions } from '../auth/[...nextauth]'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const getLocationOrder = (preferredLocation) => {
  const availableLocations = Object.keys(LOCATIONS || {})

  if (!preferredLocation) {
    return availableLocations
  }

  const normalizedPreferred = preferredLocation.trim()
  const order = [normalizedPreferred]

  availableLocations.forEach((locationKey) => {
    if (locationKey !== normalizedPreferred) {
      order.push(locationKey)
    }
  })

  return order
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

  const locationsToTry = getLocationOrder(normalizedPreferredLocation)

  try {
    let foundGameTeam = null
    let resolvedLocation = null

    for (const locationKey of locationsToTry) {
      if (!locationKey) continue

      try {
        const db = await dbConnect(locationKey)

        if (!db) {
          continue
        }

        // eslint-disable-next-line no-await-in-loop
        const gameTeam = await db.model('GamesTeams').findById(gameTeamId).lean()

        if (gameTeam) {
          foundGameTeam = gameTeam
          resolvedLocation = locationKey
          break
        }
      } catch (dbError) {
        console.error(
          'Failed to lookup gameTeam in location',
          locationKey,
          dbError
        )
      }
    }

    if (!foundGameTeam || !resolvedLocation) {
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

    return res.status(200).json({
      success: true,
      gameTeam: {
        id: String(foundGameTeam._id),
        gameId,
        teamId,
        location: resolvedLocation,
      },
    })
  } catch (error) {
    console.error('Failed to load game team info', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось получить данные команды игры' })
  }
}
