import Games from '@models/Games'

import check from 'telegram/func/check'

const setPenaltyCodeCode = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новый штрафной код',
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
  penaltyCodes[jsonCommand.j].code = jsonCommand.message.trim().toLowerCase()
  tasks[jsonCommand.i].penaltyCodes = penaltyCodes

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Штрафной код обновлен`,
    nextCommand: {
      c: 'editPenaltyCode',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default setPenaltyCodeCode
