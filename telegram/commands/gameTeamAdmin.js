import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import { ADMIN_TELEGRAM_IDS } from 'telegram/constants'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const gameTeamAdmin = async ({ telegramId, jsonCommand }) => {
  const isAdmin = ADMIN_TELEGRAM_IDS.includes(telegramId)

  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  const teamUsers = await TeamsUsers.find({
    // userTelegramId: telegramId,
    teamId: String(team._id),
  })

  const usersTelegramIds = teamUsers.map((teamUser) => teamUser.userTelegramId)

  const users = await Users.find({
    telegramId: { $in: usersTelegramIds },
  })

  const capitanTelegramId = teamUsers.find(
    (teamUser) => teamUser.role === 'capitan'
  )?.userTelegramId

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(users, page, (user, number) => ({
    text: `\u{1F4AC} ${user.name}${
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
      .join('\n')}`,
    buttons: [
      ...buttons,
      {
        c: {
          c: 'delGameTeam',
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
