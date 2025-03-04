import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getTeam from 'telegram/func/getTeam'

const joinGameAdmin = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand.teamId, db)
  if (team.success === false) return team

  // Проверяем выбрана ли игра
  if (jsonCommand.gameId) {
    const game = await getGame(jsonCommand.gameId, db)
    if (game.success === false) return team
    await db.model('GamesTeams').create({
      teamId: jsonCommand.teamId,
      gameId: jsonCommand.gameId,
    })
    return {
      message: `Вы зарегистрировали команду "${
        team?.name
      }" на игру ${formatGameName(game)}`,
      nextCommand: {
        c: `teamGamesAdmin`,
        teamId: jsonCommand.teamId,
        page: jsonCommand.page,
      },
    }
  }

  const games = await db.model('Games').find({})

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
        c: {
          c: `teamGamesAdmin`,
          teamId: jsonCommand.teamId,
          page: jsonCommand.page,
        },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default joinGameAdmin
