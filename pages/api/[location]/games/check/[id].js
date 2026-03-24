import dbConnectGlobal from '@utils/dbConnectGlobal'
import { getGameValidationErrors } from '@helpers/isGameHaveErrors'

export default async function handler(req, res) {
  const { query, method } = req
  const id = query.id
  const location = query.location

  if (method !== 'GET') {
    return res?.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  if (!id || !location) {
    return res
      ?.status(400)
      .json({ success: false, error: 'Не указан идентификатор игры или площадки' })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return res
        ?.status(500)
        .json({ success: false, error: 'Нет подключения к базе данных' })
    }

    const game = await db.model('Games').findById(id).lean()
    if (!game) {
      return res?.status(404).json({ success: false, error: 'Игра не найдена' })
    }

    const existingGameLocation =
      typeof game.location === 'string' ? game.location.trim().toLowerCase() : null
    if (existingGameLocation && existingGameLocation !== String(location).trim().toLowerCase()) {
      return res
        ?.status(403)
        .json({ success: false, error: 'Игра недоступна для выбранной площадки' })
    }

    const errors = getGameValidationErrors(game)

    return res?.status(200).json({
      success: true,
      data: {
        hasErrors: errors.length > 0,
        errors,
      },
    })
  } catch (error) {
    console.error('Failed to validate game', error)
    return res
      ?.status(500)
      .json({ success: false, error: 'Не удалось выполнить проверку игры' })
  }
}
