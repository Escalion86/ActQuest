import secondsToTimeStr from '@helpers/secondsToTimeStr'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'

import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const gameAddings = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId)
  if (game.success === false) return game

  const gameTeams = await GamesTeams.find({ gameId: jsonCommand?.gameId })
  if (!gameTeams || gameTeams.length === 0) {
    return {
      message: 'Никто не записался на игру',
      nextCommand: `menuGames`,
    }
  }

  const teamsIds = gameTeams.map(
    (gameTeam) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      gameTeam.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(teams, page, (team, number) => {
    const gameTeam = gameTeams.find(
      (gameTeam) => gameTeam.teamId === String(team._id)
    )
    const timeAdding =
      gameTeam.timeAddings?.length > 0
        ? gameTeam.timeAddings.reduce((acc, { time }) => {
            return acc + time
          }, 0)
        : undefined

    return {
      text: `${number}. "${team.name}"${
        typeof timeAdding === 'number'
          ? ` ${timeAdding < 0 ? `\u{1F7E2}` : `\u{1F534}`} ${secondsToTimeStr(
              Math.abs(timeAdding),
              true
            )}`
          : ''
      }`,
      c: { c: 'gameTeamAddings', gameTeamId: gameTeam._id },
    }
  })

  return {
    message: `Выберите команду для добавления бонусов/штрафов`,
    buttons: [
      ...buttons,
      {
        c: { c: 'editGameGeneral', gameId: jsonCommand?.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameAddings
