import Games from '@models/Games'

import check from 'telegram/func/check'

const setBonusCodeBonus = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message:
        'Введите бонус за введение кода в секундах. Число должно быть больше нуля',
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

  const bonus = jsonCommand.message
  if (!(bonus == Number(bonus) && Number(bonus) > 0)) {
    return {
      success: true,
      message: 'Бонус должен быть в секундах и больше нуля!',
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
  bonusCodes[jsonCommand.j].bonus = String(bonus)
  tasks[jsonCommand.i].bonusCodes = bonusCodes

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Бонус за введение бонусного кода обновлен`,
    nextCommand: {
      c: 'editBonusCode',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default setBonusCodeBonus
