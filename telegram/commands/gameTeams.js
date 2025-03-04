import { getNounTeams } from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameTeams = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId, db)
  if (game.success === false) return game

  const gameTeams = await db
    .model('GamesTeams')
    .find({
      gameId: jsonCommand?.gameId,
    })
    .lean()
  if (!gameTeams || gameTeams.length === 0) {
    return {
      message: 'Никто не записался на игру',
      nextCommand: `menuGames`,
    }
  }

  const teamsIds = gameTeams.map(({ teamId }) => teamId)

  const teams = await db
    .model('Teams')
    .find({
      _id: { $in: teamsIds },
    })
    .lean()

  const teamsUsers = await db
    .model('TeamsUsers')
    .find({ teamId: { $in: teamsIds } })
    .lean()

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(teams, page, (team, number) => {
    const gameTeam = gameTeams.find(
      (gameTeam) => gameTeam.teamId === String(team._id)
    )
    return {
      text: `${number}. "${team.name}"`,
      c: { c: 'gameTeam', gameTeamId: gameTeam._id },
    }
  })

  return {
    message: `На игру <b>${formatGameName(
      game
    )}</b> зарегистрировано ${getNounTeams(teams.length)} (${
      teamsUsers.length
    } чел.)\n${teams
      .map(
        (team, index) =>
          `\n${index + 1}. "${team.name}" (${
            teamsUsers.filter(({ teamId }) => teamId === String(team._id))
              .length
          } чел.)`
      )
      .join('')}`,
    buttons: [
      ...buttons,
      { c: { c: 'game', gameId: jsonCommand?.gameId }, text: '\u{2B05} Назад' },
    ],
  }
}

export default gameTeams
