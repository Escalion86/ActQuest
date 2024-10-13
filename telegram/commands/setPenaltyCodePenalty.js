import Games from '@models/Games'

import check from 'telegram/func/check'

const setPenaltyCodePenalty = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message:
        'Введите штраф за введение кода в секундах. Число должно быть больше нуля',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editPenaltyCode',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
      ],
    }
  }

  const penalty = jsonCommand.message
  if (!(penalty == Number(penalty) && Number(penalty) > 0)) {
    return {
      success: true,
      message: 'Штраф должен быть в секундах и больше нуля!',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editPenaltyCode',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
      ],
    }
  }

  const game = await Games.findById(jsonCommand.gameId)
  const tasks = game.tasks
  const penaltyCodes = [...tasks[jsonCommand.i].penaltyCodes]
  penaltyCodes[jsonCommand.j].penalty = penalty
  tasks[jsonCommand.i].penaltyCodes = penaltyCodes

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Штраф за введение штрафного кода обновлен`,
    nextCommand: {
      c: 'editPenaltyCode',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default setPenaltyCodePenalty
