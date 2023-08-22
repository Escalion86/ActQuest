import getNoun from '@helpers/getNoun'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameTeams = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId)
  if (game.success === false) return game

  await dbConnect()
  const gameTeams = await GamesTeams.find({ gameId: jsonCommand?.gameId })
  if (!gameTeams || gameTeams.length === 0) {
    return {
      message: 'Никто не записался на игру',
      nextCommand: `menuGames`,
    }
  }

  const page = jsonCommand?.page ?? 1

  const teamsIds = gameTeams.map(
    (gameTeam) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      gameTeam.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  const buttons = [
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
    ...teams,
  ]
    .filter((team, index) => index < page * 10 && index >= (page - 1) * 10)
    .map((team, index) => {
      const gameTeam = gameTeams.find(
        (gameTeam) => gameTeam.teamId === String(team._id)
      )
      return {
        text: `${index + 1 + (page - 1) * 10}. "${team.name}"`,
        c: { c: 'gameTeam', gameTeamId: gameTeam._id },
        // `teamUser/teamUserId=${teamUser._id}`,
      }
    })
  // for (let i = 0; i < 12; i++) {
  //   buttons.push({
  //     text: `${i}. "test"`,
  //     c: { c: 'gameTeam', gameTeamId: '123' },
  //     // `teamUser/teamUserId=${teamUser._id}`,
  //   })
  // }

  return {
    message: `<b>Команды зарегистрированные на игру ${formatGameName(
      game
    )}</b>\n<b>Количество команд:</b> ${getNoun(
      teams.length,
      'команда',
      'команды',
      'команд'
    )}`,
    buttons: [
      ...buttons,
      [
        {
          c: { page: page - 1 },
          text: `\u{25C0} ${page - 2 || ''}1-${page - 1}0`,
          hide: page <= 1,
        },
        {
          c: { page: page + 1 },
          text: `${page}1-${
            (page + 1) * 10 > teams.length * 15
              ? teams.length * 15
              : (page + 1) * 10
          } \u{25B6}`,
          hide: teams.length * 15 < page * 10,
        },
      ],
      { c: { c: 'game', gameId: jsonCommand?.gameId }, text: '\u{2B05} Назад' },
    ],
  }
}

export default gameTeams
