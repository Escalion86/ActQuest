import check from 'telegram/func/check'

const setSubTaskTask = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите доп. задание',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editSubTask',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
      ],
    }
  }
  const game = await db.model('Games').findById(jsonCommand.gameId)
  const tasks = game.tasks
  const subTasks = [...tasks[jsonCommand.i].subTasks]
  subTasks[jsonCommand.j].task = jsonCommand.message
  tasks[jsonCommand.i].subTasks = subTasks

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Доп. задание обновлено`,
    nextCommand: {
      c: 'editSubTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default setSubTaskTask
