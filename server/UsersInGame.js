import { toStringId } from '@helpers/idAndDate'
import normalizeTelegramId from '@helpers/normalizeTelegramId'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import sanitizeGameForPublicRead from '@helpers/sanitizeGameForPublicRead'
import isUserAdmin from '@helpers/isUserAdmin'

export default async function UsersInGame(req, res) {
  const { query, method } = req

  if (!isUserAdmin({ role: req.session?.user?.role })) {
    return res?.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  const id = query?.id
  const location = query?.location

  switch (method) {
    case 'GET':
      try {
        const db = await dbConnectGlobal()
        if (!db)
          return res?.status(400).json({ success: false, error: 'db error' })

        const game = await db
          .model('Games')
          .findOne({
            _id: id,
            location: String(location || '').trim().toLowerCase(),
          })
          .lean()
        if (!game) {
          return res?.status(404).json({ success: false, error: 'Игра не найдена' })
        }
        const gameTeams = await db
          .model('GamesTeams')
          .find({ gameId: id })
          .lean()
        const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)
        const teams = await db
          .model('Teams')
          .find({
            _id: { $in: teamsIds },
          })
          .lean()
        const teamsUsers = await db
          .model('TeamsUsers')
          .find({
            teamId: { $in: teamsIds },
          })
          .lean()
        const userIds = [...new Set(teamsUsers.map((item) => toStringId(item.userId)).filter(Boolean))]
        const telegramIds = [...new Set(teamsUsers.map((item) => normalizeTelegramId(item.userTelegramId)).filter((id) => id !== null))]
        const filters = [
          ...(userIds.length ? [{ _id: { $in: userIds } }] : []),
          ...(telegramIds.length ? [{ telegramId: { $in: telegramIds } }] : []),
        ]
        const users = filters.length ? await db.model('Users')
          .find({ $or: filters }).select({ telegramId: 1, location: 1 }).lean() : []
        const usersById = new Map(users.map((user) => [toStringId(user._id), user]))
        const usersByTelegramId = new Map(users
          .filter((user) => normalizeTelegramId(user.telegramId) !== null)
          .map((user) => [normalizeTelegramId(user.telegramId), user]))
        const usersWithTeams = teamsUsers.flatMap((membership) => {
          const user = usersById.get(toStringId(membership.userId)) ||
            usersByTelegramId.get(normalizeTelegramId(membership.userTelegramId))
          if (!user) return []
          const team = teams.find((item) => toStringId(item._id) === toStringId(membership.teamId))
          return [{
            location: user.location || null,
            team: team ? { _id: team._id, name: team.name || '' } : null,
            roleInTeam: membership.role,
          }]
        })
        return res?.status(200).json({
          success: true,
          data: {
            game: sanitizeGameForPublicRead(game),
            teams: teams.map((team) => ({ _id: team._id, name: team.name || '' })),
            users: usersWithTeams,
          },
        })
      } catch (error) {
        console.log(error)
        return res?.status(400).json({ success: false, error })
      }
    default:
      return res?.status(400).json({ success: false })
  }
}
