import secondsToTimeStr from '@helpers/secondsToTimeStr'
import Games from '@models/Games'
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

  const { tasks } = game

  const { penaltyCodes } = tasks[jsonCommand.i]
  const penaltyCode = penaltyCodes[jsonCommand.j]

  if (jsonCommand.delete) {
    penaltyCodes.splice(jsonCommand.j, 1)
    tasks[jsonCommand.i].penaltyCodes = penaltyCodes

    await dbConnect()
    await Games.findByIdAndUpdate(jsonCommand.gameId, {
      tasks: game.tasks,
    })

    return {
      success: true,
      message: 'Штрафной код удален',
      nextCommand: {
        c: 'editPenaltyCodes',
        gameId: jsonCommand.gameId,
        i: jsonCommand.i,
      },
    }
  }

  if (!jsonCommand.message) {
    return {
      success: true,
      message: `Штрафной код "${penaltyCode.code}"\n\n${
        penaltyCode.description
      }\n\nШтраф: ${secondsToTimeStr(penaltyCode.penalty)}`,
      buttons: [
        {
          text: '\u{270F} Штрафной код',
          c: {
            c: 'setPenaltyCodeCode',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
        {
          text: '\u{270F} Штраф по времени',
          c: {
            c: 'setPenaltyCodePenalty',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
        {
          text: '\u{270F} Описание',
          c: {
            c: 'setPenaltyCodeDescription',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
        {
          text: '\u{1F5D1} Удалить код',
          c: {
            delete: true,
          },
        },
        {
          text: '\u{2B05} Назад',
          c: {
            c: 'editPenaltyCodes',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }
}

export default editPenaltyCode
