import getNoun from '@helpers/getNoun'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameTasksEdit = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (jsonCommand.taskUp !== undefined)
    console.log('jsonCommand.taskUp :>> ', jsonCommand.taskUp)
  if (jsonCommand.taskDown !== undefined)
    console.log('jsonCommand.taskDown :>> ', jsonCommand.taskDown)
  delete jsonCommand.taskUp
  delete jsonCommand.taskDown

  const buttons = game.tasks
    ? game.tasks.map((task, index) => {
        return [
          {
            c: { taskUp: index },
            text: `Вверх`,
            // hide: index === 0,
          },
          {
            c: { c: 'editTask', gameId: jsonCommand.gameId, i: index },
            //`setTeamName/teamId=${jsonCommand.teamId}`,
            text: `\u{270F} "${task.title}"`,
          },
          {
            c: { taskDown: index },
            text: `Вниз`,
            // hide: index >= game.tasks.length - 1,
          },
        ]
      })
    : []

  return {
    message: `<b>Редактирование заданий игры ${formatGameName(
      game
    )}</b>\n\n<b>Задания (${game?.tasks?.length ?? 0} шт)</b>:\n${
      game?.tasks?.length
        ? game?.tasks
            .map(
              (task) =>
                ` - "${task.title}". Коды (${task?.codes?.length ?? 0} шт): ${
                  task?.codes?.length ? task.codes.join(', ') : '[не заданы]'
                }`
            )
            .join('\n')
        : '[нет заданий]'
    }`,
    buttons: [
      ...buttons,
      {
        c: { c: 'createTask', gameId: jsonCommand.gameId },
        text: '\u{2795} Создать задание',
      },
      {
        c: { c: 'editGame', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTasksEdit
