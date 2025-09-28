import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'

const setCluesPenalty = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите штраф за досрочную подсказку в секундах',
      buttons: [
        {
          text: 'Без штрафа',
          c: { message: '0' },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'cluesSettings', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  const value = Number(jsonCommand.message)
  if (!Number.isFinite(value) || value < 0) {
    return {
      success: false,
      message: 'Штраф должен быть неотрицательным числом (в секундах)',
    }
  }

  const penalty = Math.floor(value)

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    clueEarlyPenalty: penalty,
  })

  return {
    success: true,
    message: `Штраф за досрочную подсказку обновлен на "${
      penalty > 0 ? secondsToTimeStr(penalty) : 'без штрафа'
    }"`,
    nextCommand: { c: 'cluesSettings', gameId: jsonCommand.gameId },
  }
}

export default setCluesPenalty
