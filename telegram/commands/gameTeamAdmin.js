import isUserAdmin from '@helpers/isUserAdmin'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const gameTeamAdmin = async ({ telegramId, jsonCommand, user, db }) => {
  const isAdmin = isUserAdmin(user)

  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId, db)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId, db)
  if (team.success === false) return team

  const teamUsers = await db.model('TeamsUsers').find({
    // userTelegramId: telegramId,
    teamId: String(team._id),
  })

  const usersTelegramIds = teamUsers.map((teamUser) => teamUser.userTelegramId)

  const users = await db.model('Users').find({
    telegramId: { $in: usersTelegramIds },
  })

  const capitanTelegramId = teamUsers.find(
    (teamUser) => teamUser.role === 'capitan'
  )?.userTelegramId

  const paymentsOfUsers = await db
    .model('UsersGamesPayments')
    .find({
      userTelegramId: { $in: usersTelegramIds },
      gameId: gameTeam.gameId,
    })
    .lean()

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(users, page, (user, number) => ({
    text: `${number}. ${user.name}${
      capitanTelegramId === user.telegramId ? ' (капитан)' : ''
    }`,
    url: `t.me/+${user.phone}`,
  }))

  return {
    message: `<b>Игра ${formatGameName(game)}\n\nКоманда "${
      team?.name
    }"</b>\n\n<b>Состав команды</b>:\n${users
      .map(
        (user) =>
          ` - ${user.name}${
            capitanTelegramId === user.telegramId ? ' (капитан)' : ''
          }`
      )
      .join('\n')}\n\n<b>Текущие бонусы/штрафы:</b>${
      gameTeam?.timeAddings && gameTeam.timeAddings.length > 0
        ? gameTeam.timeAddings.map(({ name, time }) => {
            return `\n${
              time < 0 ? `\u{1F7E2}` : `\u{1F534}`
            } ${secondsToTimeStr(Math.abs(time), true)} - ${name}`
          })
        : ' отсутвуют'
    }\n\n<b>Суммарно оплачено командой</b>: ${paymentsOfUsers.reduce(
      (acc, { sum }) => acc + sum,
      0
    )} руб.\n\nID команды: <code>${team?._id}</code>`,
    buttons: [
      ...buttons,
      {
        c: { c: 'gameTeamAddings', gameTeamId: gameTeam._id },
        text: '\u{1F48A} Редактировать бонусы/штрафы команды',
      },
      {
        c: { c: 'gameTeamPayments', gameTeamId: gameTeam._id },
        text: '\u{1F4B2} Редактировать оплату участников команды',
      },
      {
        c: {
          c: 'delGameTeamAdmin',
          gameTeamId: jsonCommand.gameTeamId,
        },
        text: '\u{1F4A3} Удалить команду из игры',
        hide: !(
          game.status === 'active' &&
          (isAdmin || capitanTelegramId === telegramId)
        ),
      },
      {
        c: { c: 'gameTeamsAdmin', gameId: String(game._id) },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamAdmin
