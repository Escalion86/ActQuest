import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const delTask = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление задания',
      buttons: [
        {
          text: '\u{1F5D1} Удалить задание',
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
  tasks.splice(jsonCommand.i, 1)

  await updateGame(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Задание удалено`,
    nextCommand: {
      c: 'gameTasksEdit',
      gameId: jsonCommand.gameId,
    },
  }
}

export default delTask
