import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import UsersGamesPayments from '@models/UsersGamesPayments'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'
import getUsersOfTeamWithRole from 'telegram/func/getUsersOfTeamWithRole'

const gameTeamPayments = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  // Если смотрим оплату участника команды
  if (jsonCommand.userTelegramId) {
    const user = await Users.findOne({
      telegramId: jsonCommand.userTelegramId,
    }).lean()
    const paymentsOfUser = await UsersGamesPayments.find({
      userId: jsonCommand.userTelegramId,
      gameId: gameTeam.gameId,
    }).lean()

    return {
      message: `<b>Игра ${formatGameName(game)}\n\nКоманда "${
        team?.name
      }"</b>\n\n<b>Участник</b>: ${
        user.name
      }\n\nОплачено: ${paymentsOfUser.reduce(
        (acc, payment) => acc + payment.sum,
        0
      )} руб.`,
      buttons: [
        {
          c: { userTelegramId: null },
          text: '\u{2B05} Назад',
        },
      ],
    }
  }

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
      (payment) => payment.userTelegramId === user.telegramId
    )
    return {
      ...user,
      payment,
    }
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    usersWithPayments,
    page,
    ({ name, role, payment, telegramId }, number) => ({
      text: ` - ${name}${role === 'captain' ? ' (капитан)' : ''} - ${
        payment || 0
      } руб.`,
      c: { userTelegramId: telegramId },
    })
  )

  return {
    message: `<b>Игра ${formatGameName(game)}\n\nКоманда "${
      team?.name
    }"</b>\n\n<b>Состав команды</b>:\n${usersWithPayments
      .map(
        ({ name, role, payment }) =>
          ` - ${name}${role === 'captain' ? ' (капитан)' : ''} - ${
            payment || 0
          } руб.`
      )
      .join('\n')}`,
    buttons: [
      ...buttons,
      {
        c: { c: 'gameTeamAdmin', gameTeamId: jsonCommand.gameTeamId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamPayments
