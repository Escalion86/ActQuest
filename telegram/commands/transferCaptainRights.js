import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'

const transferCaptainRights = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand?.teamId, db)
  if (team.success === false) return team

  const { p } = jsonCommand

  const teamsUsers = await db
    .model('TeamsUsers')
    .find({ teamId: jsonCommand?.teamId })
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

  const users = await db.model('Users').find({
    telegramId: { $in: usersTelegramIds },
  })

  if (jsonCommand.teamUserId) {
    const teamUser = teamsUsers.find(
      (teamUser) => String(teamUser._id) === jsonCommand.teamUserId
    )
    const teamUserCapitan = teamsUsers.find(
      (teamUser) => teamUser.role === 'capitan'
    )
    const user = users.find(
      (user) => teamUser.userTelegramId === user.telegramId
    )

    if (jsonCommand.confirm) {
      await db.model('TeamsUsers').findByIdAndUpdate(teamUser._id, {
        role: 'capitan',
      })
      await db.model('TeamsUsers').findByIdAndUpdate(teamUserCapitan._id, {
        role: 'participant',
      })
      return {
        message: `Права капитана команды "${team.name}" переданы пользователю "${user.name}"`,
        nextCommand: `editTeam`,
      }
    }

    return {
      success: true,
      message: `Подтвердите передачу прав капитана команды "${team.name}" пользователю "${user.name}"`,
      buttons: [
        {
          text: '\u{1F91D} Передать права',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: {
            c: 'editTeam',
            teamId: jsonCommand.teamId,
          },
        },
      ],
    }
  }

  const buttons = users
    .filter((user) => {
      const teamUser = teamsUsers.find(
        (teamUser) => teamUser.userTelegramId === user.telegramId
      )
      return teamUser?.role !== 'capitan'
    })
    .map((user) => {
      const teamUser = teamsUsers.find(
        (teamUser) => teamUser.userTelegramId === user.telegramId
      )
      // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
      return {
        text: `${user.name}`,
        c: { teamUserId: teamUser._id },
        // `teamUser/teamUserId=${teamUser._id}`,
      }
    })

  return {
    message: `<b>Выберите участника команды для передачи прав капитана команды "${team.name}"</b>`,
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

export default transferCaptainRights
