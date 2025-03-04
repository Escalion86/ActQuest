import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const cancelTask = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите отмену задания',
      buttons: [
        {
          text: '\u{26D4} Отменить задание',
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

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game
  const tasks = [...game.tasks]
  tasks[jsonCommand.i].canceled = true

  await updateGame(
    jsonCommand.gameId,
    {
      tasks,
    },
    db
  )

  return {
    success: true,
    message: `Задание отменено`,
    nextCommand: {
      c: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default cancelTask
