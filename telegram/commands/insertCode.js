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
  const allFindedCodes = gameTeam?.findedCodes ?? []
  const findedCodes = allFindedCodes[taskNum] ?? []
  const { task, codes, numCodesToCompliteTask } = game.tasks[taskNum]

  if (findedCodes.includes(code)) {
    return {
      message: 'Такой код уже найден. Введите код',
      // nextCommand: `menuGames`,
    }
  }

  if (codes.includes(code)) {
    // Если код введен верно и ранее его не вводили
    const newFindedCodes = [...allFindedCodes]
    newFindedCodes[taskNum] = newFindedCodes
    console.log('newFindedCodes :>> ', newFindedCodes)
    // await GamesTeams.findByIdAndUpdate(jsonCommand?.gameTeamId, {
    //   findedCodes: newFindedCodes,
    // })
    return {
      message: `КОД "${code}" ПРИНЯТ`,
      // nextCommand: `menuGames`,
    }
  } else {
    return {
      message: 'Код не верен. Введите код',
      // nextCommand: `menuGames`,
    }
  }
}

export default insertCode
