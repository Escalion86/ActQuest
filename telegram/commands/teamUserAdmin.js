import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'
import getTeamUser from 'telegram/func/getTeamUser'

const teamUserAdmin = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['teamUserId'])
  if (checkData) return checkData

  const teamUser = await getTeamUser(jsonCommand.teamUserId, db)
  if (teamUser.success === false) return teamUser

  const isCapitan = teamUser.role === 'capitan'

  const team = await getTeam(teamUser.teamId, db)
  if (team.success === false) return team

  const user = await db.model('Users').findOne({
    telegramId: teamUser.userTelegramId,
  })
  if (!user || user.length === 0) {
    return {
      message: 'Ошибка. Не найден пользователь привязанный к команде',
      nextCommand: `teamUsersAdmin`,
      page: jsonCommand.page,
    }
  }

  const buttons = [
    {
      url: `t.me/+${user.phone}`,
      text: '\u{1F4AC} Написать в личку',
    },
    {
      c: {
        c: 'delTeamUserAdmin',
        teamUserId: jsonCommand.teamUserId,
        page: jsonCommand.page,
      },
      hide: isCapitan,
      text: '\u{1F4A3} Удалить из команды',
    },
    {
      c: {
        c: 'teamUsersAdmin',
        teamId: teamUser.teamId,
        page: jsonCommand.page,
      },
      text: '\u{2B05} Назад',
    },
  ]

  return {
    message: `<b>АДМИНИСТРИРОВАНИЕ</b>\n\n<b>"${user.name}" ${
      isCapitan ? 'капитан' : 'участник'
    } команды "${team.name}"</b>\n\nТелефон: <code>+${user.phone}</code>`,
    buttons,
    // parse_mode: 'Markdown',
  }
}

export default teamUserAdmin
