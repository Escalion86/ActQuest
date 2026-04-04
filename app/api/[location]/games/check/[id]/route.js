import dbConnectGlobal from '@utils/dbConnectGlobal'
import { getGameValidationErrors } from '@helpers/isGameHaveErrors'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'

export async function GET(request, { params }) {
  return runLocationLegacyHandler({
    request,
    params,
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

        const existingGameLocation =
          typeof game.location === 'string' ? game.location.trim().toLowerCase() : null
        if (existingGameLocation && existingGameLocation !== String(location).trim().toLowerCase()) {
          return res
            .status(403)
            .json({ success: false, error: 'Игра недоступна для выбранной площадки' })
        }

        const errors = getGameValidationErrors(game)
        const maxTeamPlayers =
          game?.maxTeamPlayers === null || game?.maxTeamPlayers === undefined
            ? null
            : Number(game.maxTeamPlayers)

        if (Number.isFinite(maxTeamPlayers) && maxTeamPlayers > 0) {
          const gameTeamsDocs = await db
            .model('GamesTeams')
            .find({ gameId: String(id) })
            .select({ teamId: 1 })
            .lean()

          const teamIds = Array.from(
            new Set(
              (Array.isArray(gameTeamsDocs) ? gameTeamsDocs : [])
                .map((entry) =>
                  entry?.teamId === null || entry?.teamId === undefined
                    ? ''
                    : String(entry.teamId).trim(),
                )
                .filter(Boolean),
            ),
          )

          if (teamIds.length > 0) {
            const teams = await fetchTeamsForCabinet({
              db,
              teamIds,
              location: String(location).trim().toLowerCase(),
            })

            teams.forEach((team) => {
              const membersCount = Number(team?.membersCount) || 0
              if (membersCount > maxTeamPlayers) {
                errors.push(
                  `Команда «${team?.name || team?.id || 'Без названия'}»: ${membersCount} игроков, лимит — ${maxTeamPlayers}.`,
                )
              }
            })
          }
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
