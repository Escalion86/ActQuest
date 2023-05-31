import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getTeam from 'telegram/func/getTeam'

const joinGame = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  await dbConnect()
  const teamsUser = await TeamsUsers.find({
    userTelegramId: telegramId,
    role: 'capitan',
  })

  if (!teamsUser || teamsUser.length === 0) {
    return {
      message: 'Ошибка вы не являетесь капитаном ни в одной из команд',
      nextCommand: `menuGames`,
    }
  }

  // Проверяем выбрана ли команда которую пользователь хочет регистрировать
  if (jsonCommand.teamId) {
    const team = await getTeam(jsonCommand.teamId)
    if (team.success === false) return team
    await GamesTeams.create({
      teamId: jsonCommand.teamId,
      gameId: jsonCommand.gameId,
    })
    return {
      message: `Вы зарегистрировались на игру "${game?.name}" от лица команды "${team.name}"`,
      nextCommand: `menuGames`,
    }
  }

  const teamsIds = teamsUser.map((teamUser) => teamUser.teamId)
  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  return {
    message: `Выберите команду которую вы хотите зарегистрировать на игру ${formatGameName(
      game
    )}`,
    buttons: [
      ...teams.map((team) => {
        return {
          text: `"${team.name}"`,
          c: { teamId: team._id },
        }
      }),
      { c: 'menuGames', text: '\u{2B05} Назад' },
    ],
  }
}

export default joinGame
