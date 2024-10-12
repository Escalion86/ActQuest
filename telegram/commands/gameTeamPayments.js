import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import UsersGamesPayments from '@models/UsersGamesPayments'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'
import getUsersOfTeamWithRole from 'telegram/func/getUsersOfTeam'

const gameTeamPayments = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  const usersOfTeamWithRole = getUsersOfTeamWithRole(gameTeam.teamId)

  const usersTelegramIds = usersOfTeamWithRole.map(
    (user) => user.userTelegramId
  )

  const paymentsOfUsers = await UsersGamesPayments.find({
    userId: { $in: usersTelegramIds },
    gameId: gameTeam.gameId,
  }).lean()

  const usersWithPayments = usersOfTeamWithRole.map((user) => {
    const payment = paymentsOfUsers.find(
      (payment) => payment.userTelegramId === user.userTelegramId
    )
    return {
      ...user,
      payment,
    }
  })

  return {
    message: `<b>Игра ${formatGameName(game)}\n\nКоманда "${
      team?.name
    }"</b>\n\n<b>Состав команды</b>:\n${usersWithPayments
      .map(
        (user) =>
          ` - ${user.name}${
            user.role === 'captain' ? ' (капитан)' : ''
          } - оплачено: ${user.payment || 0} руб.`
      )
      .join('\n')}`,
    buttons: [
      {
        c: { c: 'gameTeamAdmin', gameTeamId: jsonCommand.gameTeamId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamPayments
