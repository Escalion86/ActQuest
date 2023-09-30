import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'

const teamUsers = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand?.teamId)
  if (team.success === false) return team

  const { p } = jsonCommand

  await dbConnect()
  const teamsUsers = await TeamsUsers.find({ teamId: jsonCommand?.teamId })
  if (!teamsUsers || teamsUsers.length === 0) {
    return {
      message: 'Никто не состоит в команде',
      nextCommand: p
        ? { prevC: true }
        : { c: 'editTeam', teamId: jsonCommand.teamId },
    }
  }

  const usersTelegramIds = teamsUsers.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.userTelegramId
  )

  const users = await Users.find({
    telegramId: { $in: usersTelegramIds },
  })

  const buttons = users.map((user) => {
    const teamUser = teamsUsers.find((teamUser) => {
      return teamUser.userTelegramId === user.telegramId
    })
    // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
    return {
      text: `${user.name}${teamUser?.role === 'capitan' ? ' (капитан)' : ''}`,
      c: { c: 'teamUser', teamUserId: teamUser._id },
      // `teamUser/teamUserId=${teamUser._id}`,
    }
  })

  return {
    message: `<b>Состав команды "${team.name}"</b>`,
    buttons: [
      ...buttons,
      {
        c: {
          c: p ? { prevC: true } : 'editTeam',
          teamId: jsonCommand.teamId,
        },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default teamUsers
