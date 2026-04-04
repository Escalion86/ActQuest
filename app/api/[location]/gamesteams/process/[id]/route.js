import dbConnectGlobal from '@utils/dbConnectGlobal'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'

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

          const data = await db.model('GamesTeams').findById(id).lean()
          if (!data) {
            return res
              .status(404)
              .json({ success: false, error: 'Команда в игре не найдена' })
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
