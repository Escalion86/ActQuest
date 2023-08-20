import Games from '@models/Games'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const swapElements = (array, index1, index2) =>
  ([array[index1], array[index2]] = [array[index2], array[index1]])

const gameTasksEdit = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  var game = await getGame(jsonCommand.gameId)
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
      await Games.findByIdAndUpdate(jsonCommand.gameId, {
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
  // console.log('jsonCommand.taskUp :>> ', jsonCommand.taskUp)
  if (jsonCommand.taskDown !== undefined) {
    if (jsonCommand.taskDown >= game.tasks.length - 1) {
      return {
        message: `Нельзя переместить ниже задание, которое и так является последним`,
        nextCommand: { c: `gameTasksEdit`, gameId: jsonCommand.gameId },
      }
    } else {
      const tasks = [...game.tasks]
      swapElements(tasks, jsonCommand.taskDown, jsonCommand.taskDown + 1)
      await Games.findByIdAndUpdate(jsonCommand.gameId, {
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
            .map((task) => {
              const codes =
                typeof task?.codes === 'object'
                  ? codes.filter((code) => code !== '')
                  : []
              return ` - "${task.title}". Коды (${codes.length ?? 0} шт): ${
                codes.length > 0 ? codes.join(', ') : '[не заданы]'
              }`
            })
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
