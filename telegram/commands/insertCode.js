import getNoun from '@helpers/getNoun'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'

const insertCode = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const code = jsonCommand.message
  if (!code) {
    return {
      message: 'Введите код',
      // nextCommand: `menuGames`,
    }
  }

  const gameTeam = await getGameTeam(jsonCommand?.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const taskNum = gameTeam?.activeNum ?? 0

  const { task, codes, numCodesToCompliteTask } = game.tasks[taskNum]

  const allFindedCodes =
    gameTeam?.findedCodes ?? Array(game.tasks.length).map(() => [])
  const findedCodesInTask = allFindedCodes[taskNum] ?? []

  if (findedCodesInTask.includes(code)) {
    return {
      message: 'Такой код уже найден. Введите код',
      // nextCommand: `menuGames`,
    }
  }

  if (codes.includes(code)) {
    // Если код введен верно и ранее его не вводили
    const newAllFindedCodes = [...allFindedCodes]
    const newFindedCodesInTask = [...findedCodesInTask, code]
    newAllFindedCodes[taskNum] = newFindedCodesInTask

    await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
      findedCodes: newAllFindedCodes,
    })

    const numOfCodesToFind = numCodesToCompliteTask ?? codes.length
    const numOfCodesToFindLeft = numOfCodesToFind - newFindedCodesInTask.length
    const isTaskComplite = numOfCodesToFindLeft <= 0

    return {
      message: `КОД "${code}" ПРИНЯТ${
        numOfCodesToFindLeft > 0
          ? `\n\nОсталось найти ${getNoun(
              numOfCodesToFindLeft,
              'код',
              'кода',
              'кодов'
            )}`
          : ''
      }`,
      nextCommand: isTaskComplite
        ? { c: `nextTask`, gameTeamId: jsonCommand.gameTeamId }
        : undefined,
    }
  } else {
    return {
      message: 'Код не верен. Введите код',
      // nextCommand: `menuGames`,
    }
  }
}

export default insertCode
