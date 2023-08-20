import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getTeam from 'telegram/func/getTeam'

const teamGamesAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand.teamId)
  if (team.success === false) return team

  await dbConnect()
  const gameTeams = await GamesTeams.find({ teamId: jsonCommand?.teamId })
  // if (!gameTeams || gameTeams.length === 0) {
  //   return {
  //     message: 'Команда не записана ни на какую игру',
  //     nextCommand: {c: 'editTeamAdmin', teamId:jsonCommand.teamId },
  //   }
  // }

  const gamesIds = gameTeams.map(
    (gameTeam) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      gameTeam.gameId
  )

  const games = await Games.find({
    _id: { $in: gamesIds },
  })

  // const buttons = games.map((team) => {
  //   const gameTeam = gameTeams.find(
  //     (gameTeam) => gameTeam.teamId === String(team._id)
  //   )
  //   return {
  //     text: `"${team.name}"`,
  //     c: { c: 'gameTeam', gameTeamId: gameTeam._id },
  //     // `teamUser/teamUserId=${teamUser._id}`,
  //   }
  // })

  return {
    message:
      gameTeams.length === 0
        ? `<b>АДМИНИСТРИРОВАНИЕ</b>\n\n<b>Команда "${team.name}" не зарегистрирована ни на какую игру</b>`
        : `<b>Игры на которые зарегистрирована команда "${
            team.name
          }"</b>:\n${games.map((game) => formatGameName(game))}`,
    buttons: [
      // ...buttons,
      {
        c: { c: 'joinGameAdmin', teamId: jsonCommand.teamId },
        text: '\u{270F} Зарегистрировать команду на игру',
      },
      {
        c: { c: 'editTeamAdmin', teamId: jsonCommand.teamId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default teamGamesAdmin
