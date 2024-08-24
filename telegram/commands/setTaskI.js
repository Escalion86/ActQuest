import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setTaskI = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (jsonCommand.noImage) {
    const game = await Games.findById(jsonCommand.gameId)
    const tasks = [...game.tasks]
    tasks[jsonCommand.i].images = []

    await Games.findByIdAndUpdate(jsonCommand.gameId, {
      tasks,
    })

    return {
      success: true,
      message: `Картинка задания убрана обновлено`,
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
      message: 'Отправьте новую картинку задания',
      buttons: [
        {
          text: 'Без картинки',
          c: { noImage: true },
          //`+noDescription=true`,
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
  const game = await Games.findById(jsonCommand.gameId)
  const tasks = [...game.tasks]
  // const task = tasks[jsonCommand.i]
  tasks[jsonCommand.i].images = [jsonCommand.message]
  // console.log('task :>> ', task)
  // const newTask = { ...task, title: jsonCommand.message }
  // console.log('newTask :>> ', newTask)
  // tasks[jsonCommand.i] = newTask

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Картинка задания установлена`,
    nextCommand: {
      c: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setTaskI
