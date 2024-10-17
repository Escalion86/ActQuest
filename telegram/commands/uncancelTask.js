import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const uncancelTask = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите активность задания',
      buttons: [
        {
          text: '\u{2705} Активировать задание',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: {
            c: 'editTask',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game
  const tasks = [...game.tasks]
  tasks[jsonCommand.i].canceled = false

  await updateGame(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Задание активировано`,
    nextCommand: {
      c: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default uncancelTask
