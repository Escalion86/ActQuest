import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const setBonusForTaskComplite = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите бонус за выполнение задания в баллах (можно указать 0)',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editTask',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  if (jsonCommand.message.trim() != Number(jsonCommand.message.trim())) {
    return {
      success: true,
      message:
        'Это должно быть положительным числом или нулём!\n\nВведите бонус за выполнение задания в баллах (можно указать 0)',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
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
  tasks[jsonCommand.i].taskBonusForComplite = Number(jsonCommand.message.trim())

  await updateGame(
    jsonCommand.gameId,
    {
      tasks,
    },
    db
  )

  return {
    success: true,
    message: `Бонус за выполнение задания обновлен`,
    nextCommand: {
      c: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setBonusForTaskComplite
