import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const delPenaltyCode = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление штрафного кода',
      buttons: [
        {
          text: '\u{1F5D1} Удалить штрафной код',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: {
            c: 'editPenaltyCodes',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
      ],
    }
  }

  await dbConnect()
  const game = await Games.findById(jsonCommand.gameId)
  const tasks = game.tasks
  tasks[jsonCommand.i].penaltyCodes = tasks[jsonCommand.i].penaltyCodes.filter(
    (penaltyCode, index) => index !== jsonCommand.j
  )

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Штрафной код удален`,
    nextCommand: {
      c: 'gameTasksEdit',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default delPenaltyCode
