import Games from '@models/Games'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const setTaskCoordinateLongitude = async ({ telegramId, jsonCommand }) => {
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

  if (!jsonCommand.message) {
    return {
      success: true,
      message: `Введите долготу`,
      buttons: [
        {
          text: '\u{2B05} Назад',
          c: {
            c: 'setTaskCoordinates',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  const { tasks } = game
  const coordinates = tasks[jsonCommand.i].coordinates
  coordinates.longtitude = jsonCommand.message
  tasks[jsonCommand.i].coordinates = coordinates

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Долгота обновлена`,
    nextCommand: {
      c: 'editTaskCoordinates',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setTaskCoordinateLongitude
