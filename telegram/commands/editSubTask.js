import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const editSubTask = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game
  if (!game.tasks)
    return {
      text: 'У игры нет заданий',
      c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  const { tasks } = game

  const { subTasks } = tasks[jsonCommand.i]
  const subTask = subTasks[jsonCommand.j]

  if (jsonCommand.delete) {
    subTasks.splice(jsonCommand.j, 1)
    tasks[jsonCommand.i].subTasks = subTasks

    await updateGame(jsonCommand.gameId, {
      tasks: game.tasks,
    })

    return {
      success: true,
      message: 'Доп. задание удалено',
      nextCommand: {
        c: 'editBonusCodes',
        gameId: jsonCommand.gameId,
        i: jsonCommand.i,
      },
    }
  }

  return {
    success: true,
    message: `Доп. задание "${subTask.name}"\n<blockquote>${
      subTask.task
    }</blockquote>\nБонус: ${secondsToTimeStr(subTask.bonus)}`,
    buttons: [
      {
        text: '\u{270F} Название',
        c: {
          c: 'setSubTaskName',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
          j: jsonCommand.j,
        },
      },
      {
        text: '\u{270F} Задание',
        c: {
          c: 'setSubTaskTask',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
          j: jsonCommand.j,
        },
      },
      {
        text: '\u{270F} Бонус',
        c: {
          c: 'setSubTaskBonus',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
          j: jsonCommand.j,
        },
      },
      {
        text: '\u{1F5D1} Удалить доп. задание',
        c: {
          delete: true,
        },
      },
      {
        text: '\u{2B05} Назад',
        c: {
          c: 'editSubTasks',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
    ],
  }
}

export default editSubTask
