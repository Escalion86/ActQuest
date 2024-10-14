import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const editTaskCoordinates = async ({ telegramId, jsonCommand }) => {
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

  const { tasks } = game
  const task = tasks[jsonCommand.i]

  const coordinates = task.coordinates
  const latitude = coordinates?.latitude || '[не задана]'
  const longitude = coordinates?.longitude || '[не задана]'
  const radius = coordinates?.radius || '[не задан]'

  if (jsonCommand.delete) {
    tasks[jsonCommand.i].coordinates = null

    await updateGame(jsonCommand.gameId, {
      tasks: game.tasks,
    })

    return {
      success: true,
      message: 'Координаты удалены',
      nextCommand: {
        c: 'editTask',
        gameId: jsonCommand.gameId,
        i: jsonCommand.i,
      },
    }
  }

  return {
    success: true,
    message: `Координаты задания №${jsonCommand.i + 1} - "${
      tasks[jsonCommand.i].title
    }"\n\n<b>Широта</b>: ${latitude}\n<b>Долгота</b>: ${longitude}\n<b>Радиус</b>: ${radius}`,
    buttons: [
      {
        text: '\u{270F} Широта',
        c: {
          c: 'setTaskCoordinateLatitude',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
      {
        text: '\u{270F} Долгота',
        c: {
          c: 'setTaskCoordinateLongitude',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
      {
        text: '\u{270F} Радиус',
        c: {
          c: 'setTaskCoordinateRadius',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
      {
        text: '\u{1F5D1} Удалить координаты',
        c: {
          delete: true,
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

export default editTaskCoordinates
