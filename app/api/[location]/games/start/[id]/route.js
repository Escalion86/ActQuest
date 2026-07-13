import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'
import { toStringId } from '@helpers/idAndDate'
import { canManageGame } from '@server/gameHistory/gameManageAccess'

const runInBackground = (label, job) => {
  Promise.resolve()
    .then(job)
    .catch((error) => {
      console.error(`[background] ${label} failed`, error)
    })
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

  const uniqueByUserId = new Map()
  users.forEach((user) => {
    const userId = toStringId(user?._id)
    if (!userId) {
      return
    }
    uniqueByUserId.set(userId, user)
  })

  return Array.from(uniqueByUserId.values())
}

const execute = (request, { params }) => {
  return runLocationLegacyHandler({
    request,
    params,
    requireAuth: true,
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

          const gameForAccess = await db
            .model('Games')
            .findById(id)
            .select({ creatorUserId: 1, creatorTelegramId: 1, moderators: 1 })
            .lean()
          if (!gameForAccess) {
            return res.status(404).json({ success: false, error: 'Игра не найдена' })
          }
          if (!canManageGame({ session: req.session, game: gameForAccess })) {
            return res.status(403).json({
              success: false,
              error: 'Недостаточно прав для запуска игры',
            })
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

          runInBackground('game start push notifications', async () => {
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
          })

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

// GET временно оставлен для совместимости с уже открытыми вкладками кабинета.
// Оба метода проходят одинаковую авторизацию и проверку прав.
export async function GET(request, context) {
  return execute(request, context)
}

export async function POST(request, context) {
  return execute(request, context)
}
