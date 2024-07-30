import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setTaskN = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новый текст задания',
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
  // await dbConnect() // TODO: Нужно ли это?
  const game = await Games.findById(jsonCommand.gameId)
  const tasks = [...game.tasks]
  // const task = tasks[jsonCommand.i]
  tasks[jsonCommand.i].task = jsonCommand.message
  // console.log('task :>> ', task)
  // const newTask = { ...task, title: jsonCommand.message }
  // console.log('newTask :>> ', newTask)
  // tasks[jsonCommand.i] = newTask

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Задание обновлено`,
    nextCommand: {
      c: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setTaskN
