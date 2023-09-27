import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const editBonusCode = async ({ telegramId, jsonCommand }) => {
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

  const { bonusCodes } = tasks[jsonCommand.i]
  const bonusCode = bonusCodes[jsonCommand.j]

  if (jsonCommand.delete) {
    bonusCodes.splice(jsonCommand.j, 1)
    tasks[jsonCommand.i].bonusCodes = bonusCodes

    await updateGame(jsonCommand.gameId, {
      tasks: game.tasks,
    })

    return {
      success: true,
      message: 'Бонусный код удален',
      nextCommand: {
        c: 'editBonusCodes',
        gameId: jsonCommand.gameId,
        i: jsonCommand.i,
      },
    }
  }

  if (!jsonCommand.message) {
    return {
      success: true,
      message: `Бонусный код "${bonusCode.code}"\n\n${
        bonusCode.description
      }\n\nШтраф: ${secondsToTimeStr(bonusCode.bonus)}`,
      buttons: [
        {
          text: '\u{270F} Бонусный код',
          c: {
            c: 'setBonusCodeCode',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
        {
          text: '\u{270F} Бонус по времени',
          c: {
            c: 'setBonusCodeBonus',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
            j: jsonCommand.j,
          },
        },
        {
          text: '\u{270F} Описание',
          c: {
            c: 'setBonusCodeDescription',
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
            c: 'editBonusCodes',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }
}

export default editBonusCode
