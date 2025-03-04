import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const setTaskCoordinateRadius = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
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

  if (!jsonCommand.message) {
    return {
      success: true,
      message: `Введите радиус`,
      buttons: [
        {
          text: '\u{2B05} Назад',
          c: {
            c: 'editTaskCoordinates',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  const { tasks } = game
  const coordinates = tasks[jsonCommand.i]?.coordinates || {}
  coordinates.radius = jsonCommand.message
  tasks[jsonCommand.i].coordinates = coordinates

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    tasks,
  })

  return {
    success: true,
    message: `Радиус обновлен`,
    nextCommand: {
      c: 'editTaskCoordinates',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setTaskCoordinateRadius
