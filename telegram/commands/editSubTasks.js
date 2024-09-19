import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editSubTasks = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game
  if (!game.tasks)
    return {
      text: 'У игры нет заданий',
      c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  const task = game.tasks[jsonCommand.i]

  const { subTasks } = task
  const buttons =
    !subTasks || typeof subTasks !== 'object'
      ? []
      : subTasks.map(({ name, task, bonus }, index) => {
          return {
            text: `\u{270F} "${name}" - ${bonus} б.`,
            c: {
              c: 'editSubTask',
              gameId: jsonCommand.gameId,
              i: jsonCommand.i,
              j: index,
            },
          }
        })

  return {
    success: true,
    message: `Список доп. заданий${
      subTasks.length === 0
        ? ' пуст'
        : `:\n${
            subTasks.length > 0
              ? subTasks
                  .map(
                    ({ name, task, bonus }) =>
                      `"${name}" - ${bonus} б.\n<blockquote>${task}</blockquote>`
                  )
                  .join(',\n')
              : ''
          }`
    }`,
    buttons: [
      ...buttons,
      {
        text: '\u{2795} Добавить доп. задание',
        c: {
          c: 'addSubTask',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
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

export default editSubTasks
