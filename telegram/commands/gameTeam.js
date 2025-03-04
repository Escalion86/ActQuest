import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const gameTeam = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId, db)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId, db)
  if (team.success === false) return team

  const teamUsers = await db
    .model('TeamsUsers')
    .find({
      // userTelegramId: telegramId,
      teamId: String(team._id),
    })
    .lean()

  const usersTelegramIds = teamUsers.map((teamUser) => teamUser.userTelegramId)

  const users = await db
    .model('Users')
    .find({
      telegramId: { $in: usersTelegramIds },
    })
    .lean()

  const capitanTelegramId = teamUsers.find(
    (teamUser) => teamUser.role === 'capitan'
  )?.userTelegramId

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
      // {
      //   c: {
      //     c: 'delGameTeam',
      //     gameTeamId: jsonCommand.gameTeamId,
      //   },
      //   text: '\u{1F4A3} Удалить команду из игры',
      //   hide: !(
      //     game.status === 'active' &&
      //     (isAdmin || capitanTelegramId === telegramId)
      //   ),
      // },
      {
        c: { c: 'gameTeams', gameId: String(game._id) },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeam
