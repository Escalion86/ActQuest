import CRUD from '@server/CRUD'
import dbConnect from '@utils/dbConnect'

const buildResetPayload = () => ({
  activeNum: 0,
  findedCodes: [],
  wrongCodes: [],
  findedPenaltyCodes: [],
  findedBonusCodes: [],
  startTime: [],
  endTime: [],
  photos: [],
  forcedClues: [],
  timeAddings: [],
  timerId: null,
})

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return CRUD('Games', req, res)
  }

  const {
    query: { id, location },
    body,
  } = req

  if (!location || !id) {
    return res
      .status(400)
      .json({ success: false, error: 'Не указан идентификатор игры или площадки' })
  }

  const updatePayload = body?.data

  if (!updatePayload || typeof updatePayload !== 'object') {
    return res
      .status(400)
      .json({ success: false, error: 'Отсутствуют данные для обновления игры' })
  }

  try {
    const db = await dbConnect(location)

    if (!db) {
      return res
        .status(500)
        .json({ success: false, error: 'Нет подключения к базе данных' })
    }

    const Games = db.model('Games')
    const existingGame = await Games.findById(id)

    if (!existingGame) {
      return res.status(404).json({ success: false, error: 'Игра не найдена' })
    }

    const nextStatus = updatePayload.status ?? existingGame.status
    const shouldReset =
      existingGame.status === 'finished' && nextStatus === 'active'

    const updateData = { ...updatePayload }

    if (shouldReset) {
      updateData.dateStartFact = null
      updateData.dateEndFact = null
      updateData.result = null
    }

    const updatedGame = await Games.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })

    if (!updatedGame) {
      return res
        .status(400)
        .json({ success: false, error: 'Не удалось обновить игру' })
    }

    if (shouldReset) {
      const GamesTeams = db.model('GamesTeams')
      await GamesTeams.updateMany({ gameId: id }, { $set: buildResetPayload() })
    }

    return res.status(200).json({ success: true, data: updatedGame })
  } catch (error) {
    console.error('Failed to update game', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось обновить игру' })
  }
}
