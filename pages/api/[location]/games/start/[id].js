import gameStart from '@server/gameStart'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import dbConnectGlobal from '@utils/dbConnectGlobal'
// import gameProcess from 'telegram/commands/gameProcess'

const toStringId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value.toString === 'function') {
    const parsed = value.toString()
    return parsed === '[object Object]' ? null : parsed
  }

  return null
}

const getRegisteredUsersByGame = async ({ db, gameId }) => {
  const normalizedGameId = toStringId(gameId)
  if (!normalizedGameId) {
    return []
  }

  const GamesTeams = db.model('GamesTeams')
  const TeamsUsers = db.model('TeamsUsers')
  const Users = db.model('Users')

  const gameTeams = await GamesTeams.find({ gameId: normalizedGameId })
    .select({ teamId: 1 })
    .lean()
  const teamIds = Array.from(
    new Set(gameTeams.map((item) => toStringId(item?.teamId)).filter(Boolean)),
  )

  if (teamIds.length === 0) {
    return []
  }

  const memberships = await TeamsUsers.find({ teamId: { $in: teamIds } })
    .select({ userId: 1, userTelegramId: 1 })
    .lean()

  const objectIdUserIds = Array.from(
    new Set(
      memberships
        .map((item) => toStringId(item?.userId))
        .filter((value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)),
    ),
  )
  const telegramIds = Array.from(
    new Set(
      memberships
        .map((item) => Number(item?.userTelegramId))
        .filter((value) => Number.isFinite(value)),
    ),
  )

  if (objectIdUserIds.length === 0 && telegramIds.length === 0) {
    return []
  }

  const users = await Users.find({
    $or: [
      ...(objectIdUserIds.length > 0 ? [{ _id: { $in: objectIdUserIds } }] : []),
      ...(telegramIds.length > 0 ? [{ telegramId: { $in: telegramIds } }] : []),
    ],
  })
    .select({ _id: 1, telegramId: 1, pushSubscriptions: 1 })
    .lean()

  const uniqueByTelegramId = new Map()
  users.forEach((user) => {
    const telegramId = Number(user?.telegramId)
    if (!Number.isFinite(telegramId)) {
      return
    }
    uniqueByTelegramId.set(telegramId, user)
  })

  return Array.from(uniqueByTelegramId.values())
}

export default async function handler(req, res) {
  const { query, method } = req
  const id = query.id
  const location = query.location

  switch (method) {
    case 'GET':
      try {
        if (id) {
          const db = await dbConnectGlobal()
          if (!db) return {}

          // const data = await db.model('GamesTeams').findById(id).lean()
          // if (!data) {
          //   return res?.status(400).json({ success: false })
          // }
          const jsonCommand = {
            gameId: id,
            confirm: true,
          }

          const result = await gameStart({ jsonCommand, location, db })
          const message = result.message

          try {
            const game = await db
              .model('Games')
              .findById(id)
              .select({ _id: 1, name: 1, location: 1 })
              .lean()

            const gameName =
              typeof game?.name === 'string' && game.name.trim()
                ? game.name.trim()
                : 'Без названия'
            const users = await getRegisteredUsersByGame({ db, gameId: id })

            if (users.length > 0) {
              await broadcastNotificationToUsers({
                db,
                users,
                notification: {
                  title: `Старт игры «${gameName}»`,
                  body: 'Игра началась. Откройте карточку игры и приступайте к заданиям.',
                  tag: `game-${id}-started`,
                  location:
                    (typeof game?.location === 'string' && game.location.trim()) ||
                    (typeof location === 'string' && location.trim()) ||
                    'global',
                  data: {
                    type: 'game_started',
                    gameId: String(id),
                    gameName,
                    url: '/cabinet/games-upcoming',
                  },
                },
              })
            }
          } catch (pushError) {
            console.error('Failed to send push notifications on game start', pushError)
          }

          return res?.status(200).json({ success: true, message })
        }
      } catch (error) {
        return res?.status(400).json({ success: false })
      }
  }
  return res?.status(400).json({ success: false })
}
