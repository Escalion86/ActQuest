import { getServerSession } from 'next-auth/next'
import { authOptions } from '@pages/api/auth/[...nextauth]'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeStringId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }

  return ''
}

const normalizeTelegramId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  const asNumber = Number(value)
  return Number.isFinite(asNumber) ? asNumber : null
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Необходима авторизация' })
  }

  const teamId = normalizeStringId(req.query?.id)
  if (!teamId) {
    return res.status(400).json({ success: false, error: 'Не указан идентификатор команды' })
  }

  const userId = normalizeStringId(
    session.user.globalUserId ?? session.user.userId ?? session.user._id,
  )
  const userTelegramId = normalizeTelegramId(session.user.telegramId)
  const userRole = typeof session.user.role === 'string' ? session.user.role.trim().toLowerCase() : ''

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return res.status(503).json({ success: false, error: 'База данных недоступна' })
    }

    const TeamsModel = db.model('Teams')
    const TeamsUsersModel = db.model('TeamsUsers')
    const GamesTeamsModel = db.model('GamesTeams')
    const GamesModel = db.model('Games')

    const team = await TeamsModel.findById(teamId).select({ _id: 1, name: 1 }).lean()
    if (!team?._id) {
      return res.status(404).json({ success: false, error: 'Команда не найдена' })
    }

    if (!isElevatedRole(userRole)) {
      const membershipOr = []
      if (userId) {
        membershipOr.push({ userId })
      }
      if (userTelegramId !== null) {
        membershipOr.push({ userTelegramId })
      }

      if (membershipOr.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Недостаточно прав для удаления команды',
        })
      }

      const captainMembership = await TeamsUsersModel.findOne({
        teamId,
        role: 'capitan',
        $or: membershipOr,
      })
        .select({ _id: 1 })
        .lean()

      if (!captainMembership?._id) {
        return res.status(403).json({
          success: false,
          error: 'Удалять команду может только капитан',
        })
      }
    }

    const gameRegistrations = await GamesTeamsModel.find({ teamId })
      .select({ gameId: 1 })
      .lean()
    const gameIds = Array.from(
      new Set(
        gameRegistrations
          .map((entry) => normalizeStringId(entry?.gameId))
          .filter(Boolean),
      ),
    )

    if (gameIds.length > 0) {
      const now = new Date()
      const upcomingGames = await GamesModel.find({
        _id: { $in: gameIds },
        status: { $nin: ['finished', 'closed', 'canceled'] },
        $or: [
          { dateStart: { $gte: now } },
          { dateStart: null, status: { $in: ['active', 'started'] } },
        ],
      })
        .select({ _id: 1, name: 1 })
        .lean()

      if (upcomingGames.length > 0) {
        const upcomingGamesNames = upcomingGames
          .slice(0, 3)
          .map((game) => `«${typeof game?.name === 'string' && game.name.trim() ? game.name.trim() : 'Без названия'}»`)
          .join(', ')
        const suffix =
          upcomingGames.length > 3
            ? ` и еще ${upcomingGames.length - 3}`
            : ''

        return res.status(409).json({
          success: false,
          error: `Нельзя удалить команду: она зарегистрирована на предстоящие игры (${upcomingGamesNames}${suffix}). Сначала отмените регистрацию.`,
        })
      }
    }

    const [teamDeleteResult, teamUsersDeleteResult, gamesTeamsDeleteResult] =
      await Promise.all([
        TeamsModel.deleteOne({ _id: teamId }),
        TeamsUsersModel.deleteMany({ teamId }),
        GamesTeamsModel.deleteMany({ teamId }),
      ])

    if (!teamDeleteResult?.deletedCount) {
      return res.status(400).json({
        success: false,
        error: 'Не удалось удалить команду',
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        teamId,
        teamName: typeof team.name === 'string' ? team.name : '',
        removedMembersCount: Number(teamUsersDeleteResult?.deletedCount) || 0,
        removedGameRegistrationsCount:
          Number(gamesTeamsDeleteResult?.deletedCount) || 0,
      },
    })
  } catch (error) {
    console.error('Failed to delete team from cabinet', error)
    return res.status(500).json({
      success: false,
      error: 'Не удалось удалить команду. Попробуйте позже.',
    })
  }
}
