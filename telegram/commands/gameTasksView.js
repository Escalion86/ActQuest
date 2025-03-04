import { getNounPoints } from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import numberToEmojis from 'telegram/func/numberToEmojis'

const gameTasksView = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  var game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(game.tasks, page, (task, number) => {
    return [
      {
        c: { c: 'gameTaskView', gameId: jsonCommand.gameId, i: number - 1 },
        text: `\u{1F3AF} ${number}. "${task.title}"`,
      },
    ]
  })

  const sumOfBonuses =
    game.type === 'photo'
      ? game.tasks.reduce((sum, { taskBonusForComplite, subTasks }) => {
          return (
            sum +
            (taskBonusForComplite || 0) +
            (subTasks?.length
              ? subTasks.reduce((sum2, { bonus }) => sum2 + (bonus || 0), 0)
              : 0)
          )
        }, 0)
      : 0

  const message = `<b>Просмотр заданий игры ${formatGameName(
    game
  )}</b>\n\n<b>Задания (${game?.tasks?.length ?? 0} шт)</b>:\n${
    game?.tasks?.length
      ? game?.tasks
          .filter((task) => task)
          .map((task, index) => {
            const codes =
              typeof task?.codes === 'object'
                ? task.codes.filter((code) => code !== '')
                : []
            const bonusCodes =
              typeof task?.bonusCodes === 'object' ? task.bonusCodes : []
            const penaltyCodes =
              typeof task?.penaltyCodes === 'object' ? task.penaltyCodes : []
            return `${
              task.canceled
                ? `\u{26D4}`
                : game.type === 'photo'
                ? `\u{1F4F7}`
                : `\u{1F3AF}`
            } ${numberToEmojis(index + 1)} "${task.title}"${
              game.type === 'photo'
                ? ` - ${getNounPoints(
                    task.taskBonusForComplite || 0
                  )}\nСписок доп. заданий${
                    !task?.subTasks?.length
                      ? ' пуст'
                      : `:\n${
                          task.subTasks?.length > 0
                            ? task.subTasks
                                .map(
                                  ({ name, task, bonus }) =>
                                    `"${name}" - ${getNounPoints(bonus)}`
                                )
                                .join('\n')
                            : ''
                        }`
                  }`
                : `\nКоды (${codes.length ?? 0} шт): ${
                    codes.length > 0 ? codes.join(', ') : '[не заданы]'
                  }${
                    bonusCodes.length > 0
                      ? `\nБонусные коды (${bonusCodes.length} шт): ${bonusCodes
                          .map(({ code }) => code)
                          .join(', ')}`
                      : ''
                  }${
                    penaltyCodes.length > 0
                      ? `\nШтрафные коды (${
                          penaltyCodes.length
                        } шт): ${penaltyCodes
                          .map(({ code }) => code)
                          .join(', ')}`
                      : ''
                  }`
            }`
          })
          .join('\n\n')
      : '[нет заданий]'
  }${
    game.type === 'photo'
      ? `\n\n<b>Суммарный максимум баллов</b>: ${getNounPoints(sumOfBonuses)}`
      : ''
  }`

  return {
    message,
    buttons: [
      ...buttons,
      {
        c: { c: 'game', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTasksView
