import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import UsersGamesPayments from '@models/UsersGamesPayments'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
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
  console.log('jsonCommand :>> ', jsonCommand)
  if (jsonCommand.userTelegramId) {
    if (jsonCommand.delPaymentId) {
      await UsersGamesPayments.deleteOne({ _id: jsonCommand.delPaymentId })
      return {
        message: `Оплата удалена`,
        nextCommand: { delPaymentId: null, page2: null },
      }
    }
    if (jsonCommand.addPayment) {
      if (jsonCommand.message) {
        const payment = await UsersGamesPayments.create({
          userTelegramId: jsonCommand.userTelegramId,
          gameId: gameTeam.gameId,
          sum: parseInt(jsonCommand.message),
        })
        return {
          message: `Оплата добавлена`,
          nextCommand: { addPayment: null, page2: null },
        }
      }
      return {
        message: `Введите сумму оплаты`,
      }
    }
    const user = await Users.findOne({
      telegramId: jsonCommand.userTelegramId,
    }).lean()
    const paymentsOfUser = await UsersGamesPayments.find({
      userTelegramId: jsonCommand.userTelegramId,
      gameId: gameTeam.gameId,
    }).lean()

    const page2 = jsonCommand?.page2 ?? 1
    const buttons = buttonListConstructor(
      paymentsOfUser,
      page2,
      ({ sum, _id }, number) => ({
        text: `\u{1F5D1} ${sum || 0} руб.`,
        c: { delPaymentId: _id },
      })
    )

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
        ...buttons,
        {
          text: '\u{2795} Добавить оплату',
          c: { addPayment: true },
        },
        {
          c: { userTelegramId: null, page2: null },
          text: '\u{2B05} Назад',
        },
      ],
    }
  }

  const usersOfTeamWithRole = await getUsersOfTeamWithRole(gameTeam.teamId)

  const usersTelegramIds = usersOfTeamWithRole.map((user) => user.telegramId)

  const paymentsOfUsers = await UsersGamesPayments.find({
    userTelegramId: { $in: usersTelegramIds },
    gameId: gameTeam.gameId,
  }).lean()
  console.log('paymentsOfUsers :>> ', paymentsOfUsers)

  const usersWithPayments = usersOfTeamWithRole.map((user) => {
    const payments = paymentsOfUsers.filter(
      (payment) => payment.userTelegramId === user.telegramId
    )
    return {
      ...user,
      payments,
    }
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    usersWithPayments,
    page,
    ({ name, role, payments, telegramId }, number) => {
      const payment = payments.reduce((acc, { sum }) => acc + sum, 0)
      return {
        text: `${name}${role === 'captain' ? ' (капитан)' : ''} - ${
          payment || 0
        } руб.${payments.length > 1 ? '' : ` (${payments.length})`}`,
        c: { userTelegramId: telegramId },
      }
    }
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
