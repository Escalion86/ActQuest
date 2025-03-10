import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const setCodes = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.message && !jsonCommand.noCodes && !jsonCommand.time) {
    return {
      success: true,
      message: 'Введите коды через запятую',
      buttons: [
        {
          text: `\u{274C} Без кодов`,
          c: {
            noCodes: true,
          },
        },
        {
          text: `\u{231A} Динамический код - Время HHmm`,
          c: {
            time: true,
          },
        },
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
  // const task = tasks[jsonCommand.i]
  tasks[jsonCommand.i].codes = jsonCommand.noCodes
    ? []
    : jsonCommand.time
    ? ['[time]']
    : jsonCommand.message !== ''
    ? jsonCommand.message
        .toLowerCase()
        .split(',')
        .map((code) => code.trim())
    : []
  // console.log('task :>> ', task)
  // const newTask = { ...task, title: jsonCommand.message }
  // console.log('newTask :>> ', newTask)
  // tasks[jsonCommand.i] = newTask
  await updateGame(
    jsonCommand.gameId,
    {
      tasks,
    },
    db
  )

  return {
    success: true,
    message: `Коды обновлены`,
    nextCommand: {
      c: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setCodes
