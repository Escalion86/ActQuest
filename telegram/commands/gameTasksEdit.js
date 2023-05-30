import getNoun from '@helpers/getNoun'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const gameTasksEdit = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  const buttons = game.tasks
    ? game.tasks.map((task, index) => {
        return {
          cmd: { cmd: 'editTask', gameId: jsonCommand.gameId, i: index },
          //`setTeamName/teamId=${jsonCommand.teamId}`,
          text: `\u{270F} "${task.title}"`,
        }
      })
    : []

  return {
    message: `<b>Редактирование заданий игры "${
      game?.name
    }"</b>\n\n<b>Задания (${game?.tasks?.length ?? 0} шт)</b>:\n${
      game?.tasks?.length
        ? game?.tasks
            .map(
              (task) =>
                `"${task.title}". Коды (${task?.codes?.length ?? 0} шт): ${
                  task?.codes?.length ? task.codes.join(', ') : '[не заданы]'
                }`
            )
            .join('\n')
        : '[нет заданий]'
    }`,
    buttons: [
      ...buttons,
      {
        cmd: { cmd: 'createTask', gameId: jsonCommand.gameId },
        text: '\u{2795} Создать задание',
      },
      {
        cmd: { cmd: 'editGame', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTasksEdit
