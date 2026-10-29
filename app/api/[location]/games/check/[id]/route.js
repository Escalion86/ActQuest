import dbConnectGlobal from '@utils/dbConnectGlobal'
import { getGameValidationErrors } from '@helpers/isGameHaveErrors'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'
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

      if (!id || !location) {
        return res
          .status(400)
          .json({ success: false, error: 'Не указан идентификатор игры или площадки' })
      }

      try {
        const db = await dbConnectGlobal()
        if (!db) {
          return res
            .status(500)
            .json({ success: false, error: 'Нет подключения к базе данных' })
        }

        const game = await db.model('Games').findById(id).lean()
        if (!game) {
          return res.status(404).json({ success: false, error: 'Игра не найдена' })
        }

        if (!canManageGame({ session: req.session, game })) {
          return res.status(403).json({
            success: false,
            error: 'Недостаточно прав для проверки игры',
          })
        }

        const existingGameLocation =
          typeof game.location === 'string' ? game.location.trim().toLowerCase() : null
        if (existingGameLocation && existingGameLocation !== String(location).trim().toLowerCase()) {
          return res
            .status(403)
            .json({ success: false, error: 'Игра недоступна для выбранной площадки' })
        }

        const maxTeamPlayers =
          game?.maxTeamPlayers === null || game?.maxTeamPlayers === undefined
            ? null
            : Number(game.maxTeamPlayers)
        const checkDistribution = ['classic', 'photo'].includes(game.type) &&
          game.taskDistributionMode === 'random'
        const checkPlayersLimit = Number.isFinite(maxTeamPlayers) && maxTeamPlayers > 0
        const gameTeamsDocs = checkDistribution || checkPlayersLimit
          ? await db.model('GamesTeams').find({ gameId: String(id) })
            .select({ teamId: 1, taskSequence: 1, taskDistributionTemplate: 1 }).lean()
          : []
        const teamIds = [...new Set(gameTeamsDocs.map((entry) => String(entry.teamId || '')).filter(Boolean))]
        const teams = teamIds.length > 0 ? await fetchTeamsForCabinet({
          db,
          teamIds,
          location: String(location).trim().toLowerCase(),
        }) : []
        const names = new Map(teams.map((team) => [String(team.id || team._id), team.name]))
        const errors = getGameValidationErrors(game, gameTeamsDocs.map((entry) => ({
          ...entry,
          name: names.get(String(entry.teamId)),
        })))
        if (checkPlayersLimit) {
          teams.forEach((team) => {
            const membersCount = Number(team?.membersCount) || 0
            if (membersCount > maxTeamPlayers) {
              errors.push(
                `Команда «${team?.name || team?.id || 'Без названия'}»: ${membersCount} игроков, лимит — ${maxTeamPlayers}.`,
              )
            }
          })
        }

        return res.status(200).json({
          success: true,
          data: {
            hasErrors: errors.length > 0,
            errors,
          },
        })
      } catch (error) {
        console.error('Failed to validate game', error)
        return res
          .status(500)
          .json({ success: false, error: 'Не удалось выполнить проверку игры' })
      }
    },
  })
}
