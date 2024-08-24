import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
// import dbConnect from '@utils/dbConnect'
// import moment from 'moment-timezone'
// import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getTeam from 'telegram/func/getTeam'

const joinGameAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return

  // Проверяем выбрана ли команда
  if (jsonCommand.teamId) {
    const team = await getTeam(jsonCommand.teamId)
    if (team.success === false) return team

    await GamesTeams.create({
      teamId: jsonCommand.teamId,
      gameId: jsonCommand.gameId,
    })
    return {
      message: `Вы зарегистрировали команду "${
        team?.name
      }" на игру ${formatGameName(game)}`,
      nextCommand: { c: `gameTeamsAdmin`, gameId: jsonCommand.gameId },
    }
  }

  const gameTeams = await GamesTeams.find({ gameId: jsonCommand.gameId })
  const alreadyJoinedTeamsIDs = gameTeams.map((gameTeam) => gameTeam.teamId)
  const teams = await Teams.find({})
  const filteredTeams = teams.filter(
    (team) => !alreadyJoinedTeamsIDs.includes(String(team._id))
  )

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(filteredTeams, page, (team, number) => {
    return {
      text: `${number}. "${team.name}"`,
      c: { teamId: team._id },
    }
  })

  return {
    message: `<b>АДМИНИСТРИРОВАНИЕ</b>\n\nВыберите команду которую вы хотите зарегистрировать на игру ${formatGameName(
      game
    )}`,
    buttons: [
      ...buttons,
      {
        c: { c: `gameTeamsAdmin`, gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default joinGameAdmin
