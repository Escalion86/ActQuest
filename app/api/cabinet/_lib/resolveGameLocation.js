import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeString = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

export const resolveGameLocationById = async (gameId) => {
  const normalizedGameId = normalizeString(gameId)
  if (!normalizedGameId) {
    return { error: 'Не передан идентификатор игры', status: 400, location: null }
  }

  const db = await dbConnectGlobal()
  if (!db) {
    return {
      error: 'Соединение с базой данных не установлено',
      status: 503,
      location: null,
    }
  }

  const GamesModel = db.model('Games')
  const isObjectIdLike = /^[0-9a-fA-F]{24}$/.test(normalizedGameId)
  let game = null

  if (isObjectIdLike) {
    game = await GamesModel.findById(normalizedGameId)
      .select({ _id: 1, location: 1 })
      .lean()
  }

  if (!game?._id) {
    game = await GamesModel.findOne({ id: normalizedGameId })
      .select({ _id: 1, location: 1 })
      .lean()
  }

  if (!game?._id) {
    return { error: 'Игра не найдена', status: 404, location: null }
  }

  const location = normalizeString(game.location)
  if (!location) {
    return { error: 'Не удалось определить площадку игры', status: 400, location: null }
  }

  return { error: null, status: 200, location, gameId: String(game._id) }
}
