import dbConnectGlobal from '@utils/dbConnectGlobal'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'
import resolveTeamMembershipForIdentity from '@helpers/resolveTeamMembershipForIdentity'
import { canManageGame } from '@server/gameHistory/gameManageAccess'

export async function GET(request, { params }) {
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

          const data = await db.model('GamesTeams').findById(id).lean()
          if (!data) {
            return res
              .status(404)
              .json({ success: false, error: 'Команда в игре не найдена' })
          }

          const sessionUser = req.session?.user || {}
          const userId =
            sessionUser.globalUserId ||
            sessionUser.userId ||
            sessionUser._id ||
            sessionUser.id ||
            null
          const teamUsers = await db
            .model('TeamsUsers')
            .find({ teamId: data.teamId })
            .select({ userId: 1, userTelegramId: 1, role: 1 })
            .lean()
          const membership = resolveTeamMembershipForIdentity({
            teamUsers,
            userId,
            telegramId: sessionUser.telegramId,
          })
          const game = await db
            .model('Games')
            .findById(data.gameId)
            .select({ creatorUserId: 1, creatorTelegramId: 1, moderators: 1 })
            .lean()
          if (
            !membership.isTeamMember &&
            !canManageGame({ session: req.session, game })
          ) {
            return res.status(403).json({
              success: false,
              error: 'Нет доступа к игровому процессу этой команды',
            })
          }
          const jsonCommand = {
            gameTeamId: id,
          }

          const { default: gameProcess } = await import(
            'telegram/commands/gameProcess'
          )
          const result = await gameProcess({ jsonCommand, location, db })
          const message = result.message

          return res.status(200).json({ success: true, message })
        }
      } catch (error) {
        return res
          .status(500)
          .json({ success: false, error: 'Не удалось обработать команду игры' })
      }
      return res
        .status(400)
        .json({ success: false, error: 'Не передан идентификатор команды игры' })
    },
  })
}
