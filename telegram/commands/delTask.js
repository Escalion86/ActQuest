import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

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
          text: '\u{1F4A3} Удалить задание',
          cmd: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          cmd: {
            cmd: 'editTask',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  await dbConnect()
  const game = await Games.findById(jsonCommand.gameId)
  const tasks = [...game.tasks]
  tasks.splice(jsonCommand.i, 1)
  // const task = tasks[jsonCommand.i]
  // tasks[jsonCommand.i].clues[1].clue = jsonCommand.message
  // console.log('task :>> ', task)
  // const newTask = { ...task, title: jsonCommand.message }
  // console.log('newTask :>> ', newTask)
  // tasks[jsonCommand.i] = newTask

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Задание удалено`,
    nextCommand: {
      cmd: 'editTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default delTask
