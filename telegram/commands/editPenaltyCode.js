import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editPenaltyCode = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game
  if (!game.tasks)
    return {
      text: 'У игры нет заданий',
      c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  const task = game.tasks[jsonCommand.i]

  const { penaltyCodes } = task
  const penaltyCode = penaltyCodes[jsonCommand.j]

  if (!jsonCommand.message) {
    return {
      success: true,
      message: `Штрафной код "${penaltyCode.code}"\n${penaltyCode.description}\n${penaltyCode.penalty}`,
      buttons: [
        {
          text: '\u{270F} Изменить код',
          c: {
            c: 'setPenaltyCodeCode',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
        {
          text: '\u{270F} Изменить штраф',
          c: {
            c: 'setPenaltyCodePenalty',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
        {
          text: '\u{270F} Изменить описание',
          c: {
            c: 'setPenaltyCodeDescription',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
        // {
        //   text: '\u{1F4A3} Удалить код',
        //   c: {
        //     delete: true,
        //   },
        // },
        {
          text: '\u{1F6AB} Назад',
          c: {
            c: 'editTask',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }
}

export default editPenaltyCode
