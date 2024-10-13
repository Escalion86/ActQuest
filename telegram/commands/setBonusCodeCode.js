import Games from '@models/Games'

import check from 'telegram/func/check'

const setBonusCodeCode = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новый бонусный код',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editBonusCode',
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
  const bonusCodes = [...tasks[jsonCommand.i].bonusCodes]
  bonusCodes[jsonCommand.j].code = jsonCommand.message.trim().toLowerCase()
  tasks[jsonCommand.i].bonusCodes = bonusCodes

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Бонусный код обновлен`,
    nextCommand: {
      c: 'editBonusCode',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default setBonusCodeCode
