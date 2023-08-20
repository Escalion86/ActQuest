import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import LastCommands from '@models/LastCommands'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'

const gameMsg = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (!jsonCommand.message) {
    return {
      success: true,
      message: `Введите сообщение которое хотите отправить всем участникам игры ${formatGameName(
        game
      )}`,
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  // Получаем список команд участвующих в игре
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
  // Получаем telegramId всчех участников игры
  const allUsersTelegramIds = teamsUsers.map(
    (teamUser) => teamUser.userTelegramId
  )

  await Promise.all(
    allUsersTelegramIds.map(async (telegramId) => {
      await sendMessage({
        chat_id: telegramId,
        text: jsonCommand.message,
      })
    })
  )
  // })
  // )

  return {
    message: `Все игроки оповещены!`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default gameMsg
