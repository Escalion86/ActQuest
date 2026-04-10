import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'
import { toStringId } from '@helpers/idAndDate'

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
    .select({ userId: 1 })
    .lean()

  const objectIdUserIds = Array.from(
    new Set(
      memberships
        .map((item) => toStringId(item?.userId))
        .filter((value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)),
    ),
  )
  if (objectIdUserIds.length === 0) {
    return []
  }

  const users = await Users.find({
    _id: { $in: objectIdUserIds },
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

export async function GET(request, { params }) {
  return runLocationLegacyHandler({
    request,
    params,
    handler: async (req, res) => {
      const { query } = req
      const id = query.id
      const location = query.location

      try {
        if (id) {
          const db = await dbConnectGlobal()
          if (!db) {
            return res
              .status(503)
              .json({ success: false, error: 'Нет подключения к базе данных' })
          }

          const jsonCommand = {
            gameId: id,
            confirm: true,
          }

          const { default: gameStart } = await import('@server/gameStart')
          const result = await gameStart({ jsonCommand, location, db })
          if (result?.success === false) {
            return res.status(400).json({
              success: false,
              error: result?.error || result?.message || 'Игра не прошла проверку',
              data: {
                errors: Array.isArray(result?.errors) ? result.errors : [],
              },
            })
          }
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

          return res.status(200).json({ success: true, message })
        }
      } catch (error) {
        return res
          .status(500)
          .json({ success: false, error: 'Не удалось запустить игру' })
      }
      return res
        .status(400)
        .json({ success: false, error: 'Не передан идентификатор игры' })
    },
  })
}
