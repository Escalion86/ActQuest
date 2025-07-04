import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'
import getUsersOfTeamWithRole from 'telegram/func/getUsersOfTeamWithRole'

const gameTeamPayments = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId, db)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId, db)
  if (team.success === false) return team

  // Если смотрим оплату участника команды
  if (jsonCommand.userTelegramId) {
    if (jsonCommand.delPaymentId) {
      await db
        .model('UsersGamesPayments')
        .deleteOne({ _id: jsonCommand.delPaymentId })
      return {
        message: `Оплата удалена`,
        nextCommand: { delPaymentId: null, page2: null },
      }
    }
    if (jsonCommand.addPayment) {
      if (jsonCommand.message) {
        const payment = await db.model('UsersGamesPayments').create({
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
    const user = await db
      .model('Users')
      .findOne({
        telegramId: jsonCommand.userTelegramId,
      })
      .lean()
    const paymentsOfUser = await db
      .model('UsersGamesPayments')
      .find({
        userTelegramId: jsonCommand.userTelegramId,
        gameId: gameTeam.gameId,
      })
      .lean()

    const page2 = jsonCommand?.page2 ?? 1
    const buttons = buttonListConstructor(
      paymentsOfUser,
      page2,
      ({ sum, _id }, number) => ({
        text: `${number}. \u{1F5D1} ${sum || 0} руб.`,
        c: { delPaymentId: _id },
      })
    )

    return {
      message: `<b>Игра ${formatGameName(game)}\n\nКоманда "${
        team?.name
      }"</b>\n\n<b>Участник</b>: ${
        user.name
      }\n\n<b>Суммарно оплачено участником</b>: ${paymentsOfUser.reduce(
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

  const usersOfTeamWithRole = await getUsersOfTeamWithRole(gameTeam.teamId, db)

  const usersTelegramIds = usersOfTeamWithRole.map((user) => user.telegramId)

  const paymentsOfUsers = await db
    .model('UsersGamesPayments')
    .find({
      userTelegramId: { $in: usersTelegramIds },
      gameId: gameTeam.gameId,
    })
    .lean()

  const usersWithPayments = usersOfTeamWithRole.map((user) => {
    const payments = paymentsOfUsers.filter(
      (payment) => payment.userTelegramId == user.telegramId
    )
    const paymentsSum = payments.reduce((acc, { sum }) => acc + sum, 0)
    return {
      ...user,
      payments,
      paymentsSum,
    }
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    usersWithPayments,
    page,
    ({ name, role, payments, paymentsSum, telegramId }, number) => {
      return {
        text: `${number}. ${name}${
          role === 'captain' ? ' (капитан)' : ''
        } - ${paymentsSum} руб.${
          payments.length > 1 ? ` (${payments.length})` : ''
        }`,
        c: { userTelegramId: telegramId },
      }
    }
  )

  return {
    message: `<b>Игра ${formatGameName(game)}\n\nКоманда "${
      team?.name
    }"</b>\n\n<b>Состав команды</b>:\n${usersWithPayments
      .map(
        ({ name, role, payments, paymentsSum, telegramId }) =>
          ` - ${name}${
            role === 'captain' ? ' (капитан)' : ''
          } - ${paymentsSum} руб.${
            payments.length > 1 ? ` (${payments.length})` : ''
          }`
      )
      .join('\n')}\n\n<b>Суммарно оплачено</b>: ${usersWithPayments.reduce(
      (acc, { paymentsSum }) => acc + paymentsSum,
      0
    )} руб.`,
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
