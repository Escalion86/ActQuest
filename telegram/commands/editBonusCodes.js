import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editBonusCodes = async ({ telegramId, jsonCommand }) => {
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

  const { bonusCodes } = task
  const buttons =
    !bonusCodes || typeof bonusCodes !== 'object'
      ? []
      : bonusCodes.map(({ code, bonus, description }, index) => {
          return {
            text: `Код: ${code}`,
            c: {
              c: 'editBonusCode',
              gameId: jsonCommand.gameId,
              i: jsonCommand.i,
              j: index,
            },
          }
        })

  return {
    success: true,
    message: `Список бонусный кодов\n\n${
      bonusCodes.length > 0
        ? bonusCodes
            .map(
              ({ code, bonus, description }) =>
                `"${code}" - ${secondsToTimeStr(bonus)} - ${description}`
            )
            .join(',\n')
        : ''
    }`,
    buttons: [
      ...buttons,
      {
        text: '\u{2795} Добавить бонусный код',
        c: {
          c: 'addBonusCode',
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

export default editBonusCodes
