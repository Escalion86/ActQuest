import check from 'telegram/func/check'

const setSubTaskBonus = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message:
        'Введите бонус за выполнение доп. задания в баллах. Число должно быть больше нуля',
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

  const bonus = jsonCommand.message
  if (!(bonus == Number(bonus) && Number(bonus) > 0)) {
    return {
      success: true,
      message: 'Бонус должен быть больше нуля!',
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
  subTasks[jsonCommand.j].bonus = String(bonus)
  tasks[jsonCommand.i].subTasks = subTasks

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Бонус за выполнение доп. задания обновлен`,
    nextCommand: {
      c: 'editSubTask',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
      j: jsonCommand.j,
    },
  }
}

export default setSubTaskBonus
