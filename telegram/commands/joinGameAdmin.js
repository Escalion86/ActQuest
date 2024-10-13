import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'

// import moment from 'moment-timezone'
// import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getTeam from 'telegram/func/getTeam'

const joinGameAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand.teamId)
  if (team.success === false) return team

  // Проверяем выбрана ли игра
  if (jsonCommand.gameId) {
    const game = await getGame(jsonCommand.gameId)
    if (game.success === false) return team
    await GamesTeams.create({
      teamId: jsonCommand.teamId,
      gameId: jsonCommand.gameId,
    })
    return {
      message: `Вы зарегистрировали команду "${
        team?.name
      }" на игру ${formatGameName(game)}`,
      nextCommand: { c: `teamGamesAdmin`, teamId: jsonCommand.teamId },
    }
  }

  const games = await Games.find({})

  return {
    message: `<b>АДМИНИСТРИРОВАНИЕ</b>\n\nВыберите игру на которую вы хотите зарегистрировать команду "${team.name}"`,
    buttons: [
      ...games.map((game) => {
        return {
          text: formatGameName(game),
          c: { gameId: game._id },
        }
      }),
      {
        c: { c: `teamGamesAdmin`, teamId: jsonCommand.teamId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default joinGameAdmin
