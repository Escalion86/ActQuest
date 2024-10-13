import { getNounPoints } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import Games from '@models/Games'

import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const setTaskPenalty = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    const game = await getGame(jsonCommand.gameId)
    if (game.success === false) return game

    return {
      success: true,
      message: `Введите штраф за невыполнение задания в ${
        game.type === 'photo' ? 'баллах' : 'секундах'
      }`,
      buttons: [
        {
          text: 'Без штрафа',
          c: { message: '0' },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const value = parseInt(jsonCommand.message)
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    taskFailurePenalty: value,
  })

  return {
    success: true,
    message: `Штраф за невыполнение задания ${
      !value
        ? 'удален'
        : `обновлен на "${
            game.type === 'photo'
              ? getNounPoints(value)
              : secondsToTimeStr(value)
          }"`
    }`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setTaskPenalty
