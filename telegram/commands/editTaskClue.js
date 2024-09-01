import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const editTaskClue = async ({ telegramId, jsonCommand }) => {
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

  const { clues } = tasks[jsonCommand.i]
  // const clue = clues[jsonCommand.j]

  if (jsonCommand.delete) {
    clues.splice(jsonCommand.j, 1)
    tasks[jsonCommand.i].clues = clues

    await updateGame(jsonCommand.gameId, {
      tasks: game.tasks,
    })

    return {
      success: true,
      message: 'Подсказка удалена',
      nextCommand: {
        c: 'editTaskClues',
        gameId: jsonCommand.gameId,
        i: jsonCommand.i,
      },
    }
  }

  if (jsonCommand.message) {
    clues[jsonCommand.j].clue = jsonCommand.message
    tasks[jsonCommand.i].clues = clues

    await updateGame(jsonCommand.gameId, {
      tasks: game.tasks,
    })

    return {
      success: true,
      message: 'Подсказка обновлена',
      nextCommand: {
        c: 'editTaskClues',
        gameId: jsonCommand.gameId,
        i: jsonCommand.i,
      },
    }
  }

  return {
    success: true,
    message: `Введите новый текст подсказки`,
    buttons: [
      {
        text: '\u{1F4A3} Удалить подсказку',
        c: {
          delete: true,
        },
      },
      {
        text: '\u{2B05} Назад',
        c: {
          c: 'editTaskClues',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
    ],
  }
}

export default editTaskClue
