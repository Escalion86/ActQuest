import check from 'telegram/func/check'

const setTaskPostMessage = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (jsonCommand.noPostMessage) {
    const game = await db.model('Games').findById(jsonCommand.gameId)
    const tasks = [...game.tasks]
    tasks[jsonCommand.i].postMessage = ''

    await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
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
  const game = await db.model('Games').findById(jsonCommand.gameId)
  const tasks = [...game.tasks]
  // const task = tasks[jsonCommand.i]
  tasks[jsonCommand.i].postMessage = jsonCommand.message
  // console.log('task :>> ', task)
  // const newTask = { ...task, title: jsonCommand.message }
  // console.log('newTask :>> ', newTask)
  // tasks[jsonCommand.i] = newTask

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
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
