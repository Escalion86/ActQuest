import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setTaskPostMessage = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (jsonCommand.noPostMessage) {
    // await dbConnect() // TODO: Нужно ли это?
    const game = await Games.findById(jsonCommand.gameId)
    const tasks = [...game.tasks]
    tasks[jsonCommand.i].postMessage = ''

    await Games.findByIdAndUpdate(jsonCommand.gameId, {
      tasks,
    })

    return {
      success: true,
      message: 'Сообщение после задания удалено',
      nextCommand: {
        c: 'editTask',
        gameId: jsonCommand.gameId,
        i: jsonCommand.i,
      },
    }
  }

  if (!jsonCommand.message) {
    return {
      success: true,
      message:
        'Введите сообщение которое будет показываться игрокам после выполнения задания',
      buttons: [
        {
          text: 'Без сообщения',
          c: { noPostMessage: true },
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
  // await dbConnect() // TODO: Нужно ли это?
  const game = await Games.findById(jsonCommand.gameId)
  const tasks = [...game.tasks]
  // const task = tasks[jsonCommand.i]
  tasks[jsonCommand.i].postMessage = jsonCommand.message
  // console.log('task :>> ', task)
  // const newTask = { ...task, title: jsonCommand.message }
  // console.log('newTask :>> ', newTask)
  // tasks[jsonCommand.i] = newTask

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Сообщение после выполнения задания обновлено на "${jsonCommand.message}"`,
    nextCommand: {
      c: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setTaskPostMessage
