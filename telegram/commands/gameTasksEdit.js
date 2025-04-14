import { getNounPoints } from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import numberToEmojis from 'telegram/func/numberToEmojis'

const swapElements = (array, index1, index2) =>
  ([array[index1], array[index2]] = [array[index2], array[index1]])

const gameTasksEdit = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  var game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (jsonCommand.taskUp !== undefined) {
    if (jsonCommand.taskUp === 0) {
      return {
        message: `Нельзя переместить выше задание, которое и так является первым`,
        nextCommand: { c: `gameTasksEdit`, gameId: jsonCommand.gameId },
      }
    } else {
      const tasks = [...game.tasks]
      swapElements(tasks, jsonCommand.taskUp, jsonCommand.taskUp - 1)
      await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
        tasks,
      })
      game.tasks = tasks
      delete jsonCommand.taskUp
      // return {
      //   message: ` Задание перемещено`,
      //   nextCommand: { c: `gameTasksEdit`, gameId: jsonCommand.gameId },
      // }
    }
  }

  if (jsonCommand.taskDown !== undefined) {
    if (jsonCommand.taskDown >= game.tasks.length - 1) {
      return {
        message: `Нельзя переместить ниже задание, которое и так является последним`,
        nextCommand: { c: `gameTasksEdit`, gameId: jsonCommand.gameId },
      }
    } else {
      const tasks = [...game.tasks]
      swapElements(tasks, jsonCommand.taskDown, jsonCommand.taskDown + 1)
      await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
        tasks,
      })
      // return {
      //   message: ` Задание перемещено`,
      //   nextCommand: { c: `gameTasksEdit`, gameId: jsonCommand.gameId },
      // }
      game.tasks = tasks
      delete jsonCommand.taskDown
    }
  }

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(game.tasks, page, (task, number) => {
    const codes =
      typeof task?.codes === 'object'
        ? task.codes.filter((code) => code !== '')
        : []
    return [
      {
        c: { c: 'editTask', gameId: jsonCommand.gameId, i: number - 1 },
        //`setTeamName/teamId=${jsonCommand.teamId}`,
        text: `${
          task.canceled
            ? `\u{26D4}`
            : `${
                game.type === 'photo'
                  ? !task.title || !task.task
                    ? '\u{2757}'
                    : ''
                  : !task.title || !task.task || !codes.length
                  ? '\u{2757}'
                  : ''
              }`
        }${number}. ${task.title}`,
      },
      {
        c: number > 1 ? { taskUp: number - 1 } : { taskDown: number - 1 },
        text: number > 1 ? `\u{2B06}` : `\u{2B07}`,
        // hide: index === 0,
      },
      // {
      //   c: { taskUp: number > 1 ? number - 1 : undefined },
      //   text: `${number > 1 ? `\u{2B06}` : `\u{1F6AB}`}`,
      //   // hide: index === 0,
      // },
      // {
      //   c: { taskDown: number < game.tasks.length ? number - 1 : undefined },
      //   text: `${number < game.tasks.length ? `\u{2B07}` : `\u{1F6AB}`}`,
      //   // hide: index >= game.tasks.length - 1,
      // },
    ]
  })

  // const buttons = game.tasks
  //   ? game.tasks.map((task, index) => {
  //       return [
  //         {
  //           c: { taskUp: index },
  //           text: `Вверх`,
  //           // hide: index === 0,
  //         },
  //         {
  //           c: { c: 'editTask', gameId: jsonCommand.gameId, i: index },
  //           //`setTeamName/teamId=${jsonCommand.teamId}`,
  //           text: `\u{270F} "${task.title}"`,
  //         },
  //         {
  //           c: { taskDown: index },
  //           text: `Вниз`,
  //           // hide: index >= game.tasks.length - 1,
  //         },
  //       ]
  //     })
  //   : []
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

  const tasksCount = game?.tasks
    ? game.tasks.filter(({ canceled }) => !canceled).length
    : 0

  const canceledTasksCount = game?.tasks
    ? game.tasks.filter(({ canceled }) => canceled).length
    : 0

  const message = `<b>Редактирование заданий игры ${formatGameName(
    game
  )}</b>\n\n<b>Задания ${tasksCount} шт.${
    canceledTasksCount > 0 ? ` (${canceledTasksCount} отменено)` : ''
  }</b>\n\n<b>Список заданий</b>:\n${
    tasksCount > 0
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
                ? !task.title || !task.task
                  ? '\u{2757}'
                  : '✅'
                : !task.title || !task.task || codes.length === 0
                ? '\u{2757}'
                : '✅'
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
