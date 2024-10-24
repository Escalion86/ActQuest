import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameTeamsResult = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (game.status !== 'finished') {
    return {
      message: 'Игра еще не завершена',
      nextCommand: { c: 'game', gameId: jsonCommand.gameId },
    }
  }

  if (!game.result) {
    return {
      message: 'Результаты игры еще не сформированы',
      nextCommand: { c: 'game', gameId: jsonCommand.gameId },
    }
  }

  const { teams, gameTeams, teamsPlaces } = game.result

  const sortedTeams = teamsPlaces
    ? teams.sort(
        (a, b) => teamsPlaces[String(a._id)] - teamsPlaces[String(b._id)]
      )
    : teams

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(sortedTeams, page, (team, number) => {
    const gameTeam = gameTeams.find(
      (gameTeam) => gameTeam.teamId === String(team._id)
    )
    return {
      text: `${number}. "${team.name}"`,
      c: { c: 'gameTeamResult', gameTeamId: gameTeam._id },
    }
  })

  return {
    message: `Выберите команду для получения подробного результата на игре ${formatGameName(
      game
    )}\n\nКомманды отсорторованы по рейтингу на игре`,
    buttons: [
      ...buttons,
      {
        text: '\u{2B05} Назад',
        c: { c: 'game', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameTeamsResult
