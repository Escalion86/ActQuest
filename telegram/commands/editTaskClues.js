import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editTaskClues = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game
  if (!game.tasks)
    return {
      text: 'У игры нет заданий',
      c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  const task = game.tasks[jsonCommand.i]

  const { clues } = task
  const buttons =
    !clues || typeof clues !== 'object'
      ? []
      : clues.map(({ clue, images }, index) => {
          return {
            text: `\u{270F} Подсказка №${index + 1}`,
            c: {
              c: 'editTaskClue',
              gameId: jsonCommand.gameId,
              i: jsonCommand.i,
              j: index,
            },
          }
        })

  return {
    success: true,
    message:
      clues?.length > 0
        ? clues
            .map(
              ({ clue, images }, index) =>
                `Подсказка №${index + 1}:\n<blockquote>${clue}</blockquote>`
            )
            .join('\n')
        : `<b>Подсказок нет</b>`,
    buttons: [
      ...buttons,
      {
        text: '\u{2795} Добавить подсказку',
        c: {
          c: 'addTaskClue',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        hide: clues?.length >= 10,
      },
      {
        text: '\u{2B05} Назад',
        c: {
          c: 'editTask',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
    ],
  }
}

export default editTaskClues
