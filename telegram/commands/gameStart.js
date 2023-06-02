import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameStart = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    status: 'started',
  })
  // Получаем список команд
  const gameTeams = await GamesTeams.find({
    gameId: jsonCommand.gameId,
  })

  const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)

  // const teams = await Teams.find({
  //   _id: { $in: teamsIds },
  // })

  const teamsUsers = await TeamsUsers.find({
    teamId: { $in: teamsIds },
  })

  // const usersTelegramIds = teamsUsers.map((teamUser) => teamUser.userTelegramId)

  const startTime = [new Date()]

  await Promise.all(
    teamsIds.map(async (teamId) => {
      const gameTeam = gameTeams.find((gameTeam) => gameTeam.teamId === teamId)
      const usersTelegramIdsOfTeam = teamsUsers
        .filter((teamUser) => teamUser.teamId === teamId)
        .map((teamUser) => teamUser.userTelegramId)

      const taskNum = gameTeam?.activeNum ?? 0

      await gameTeams.findByIdAndUpdate(gameTeam._id, {
        startTime,
      })

      const findedCodes = gameTeam?.findedCodes ?? []
      console.log('findedCodes :>> ', findedCodes)
      const { task, codes, numCodesToCompliteTask } = game.tasks[taskNum]
      console.log('codes :>> ', codes)
      await Promise.all(
        usersTelegramIdsOfTeam.map(async (telegramId) =>
          sendMessage({
            chat_id: telegramId,
            text: `<b>Задание №${taskNum}</b>\n\n${task}\n\nКоличество кодов на локации: ${
              codes?.length ?? 0
            }${
              numCodesToCompliteTask
                ? `\nКоличество кодов необходимое для выполнения задания: ${numCodesToCompliteTask}`
                : ''
            }
          ${
            findedCodes?.length > 0 ? `\n\nНайденые коды: ${findedCodes}` : ''
          }`,
          })
        )
      )
    })
  )

  // console.log('usersTelegramIds :>> ', usersTelegramIds)

  return {
    message: `Игра ${formatGameName(
      game
    )} ЗАПУЩЕНА.\n\n\u{26A0} Все игроки оповещены!`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default gameStart
