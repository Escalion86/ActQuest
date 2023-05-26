import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'
import getTeamUser from 'telegram/func/getTeamUser'

const team_user = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamUserId'])
  if (checkData) return checkData

  const teamUser = await getTeamUser(jsonCommand.teamUserId)
  if (teamUser.success === false) return teamUser

  const isCapitan = teamUser.role === 'capitan'

  const team = await getTeam(teamUser.teamId)
  if (team.success === false) return team

  await dbConnect()
  const user = await Users.findOne({
    telegramId: teamUser.userTelegramId,
  })
  if (!user || user.length === 0) {
    return {
      message: 'Ошибка. Не найден пользователь привязанный к команде',
      nextCommand: `menu_teams`,
    }
  }

  const buttons = [
    {
      cmd: {
        cmd: 'del_team_user',
        teamUserId: jsonCommand.teamUserId,
      },
      hide: !isCapitan,
      text: '\u{1F4A3} Удалить из команды',
    },
    { cmd: 'menu_teams', text: '\u{2B05} Назад' },
  ]

  return {
    message: `"${user.name}" ${isCapitan ? 'капитан' : 'участник'} команды "${
      team.name
    }" [+79991234567](tel:+79991234567) <a href="tel:+79138370020">Телефон</a>"`,
    buttons,
    parse_mode: 'Markdown',
  }
}

export default team_user
