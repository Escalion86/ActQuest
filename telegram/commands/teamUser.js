import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'
import getTeamUser from 'telegram/func/getTeamUser'

const teamUser = async ({ telegramId, jsonCommand }) => {
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
      nextCommand: `menuTeams`,
    }
  }

  const buttons = [
    // {
    //   url: `https://web.telegram.org/k/#${user.telegramId}`,
    //   text: '\u{2712} Написать в личку',
    // },
    {
      cmd: {
        cmd: 'delTeamUser',
        teamUserId: jsonCommand.teamUserId,
      },
      hide: isCapitan,
      text: '\u{1F4A3} Удалить из команды',
    },
    {
      cmd: { cmd: 'teamUsers', teamId: teamUser.teamId },
      text: '\u{2B05} Назад',
    },
  ]

  return {
    message: `"${user.name}" ${isCapitan ? 'капитан' : 'участник'} команды "${
      team.name
    }"\n<a href="tg://user?id=${user.telegramId}">Написать в личку</a>`,
    buttons,
    // parse_mode: 'Markdown',
  }
}

export default teamUser
