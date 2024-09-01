import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const delTaskClue = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление подсказки №' + (jsonCommand.j + 1),
      buttons: [
        {
          text: '\u{1F5D1} Удалить подсказку',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: {
            c: 'editTaskClues',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  const { tasks } = game

  const { clues } = tasks[jsonCommand.i]

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

export default delTaskClue
