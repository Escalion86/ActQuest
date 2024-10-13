import getNoun from '@helpers/getNoun'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'

import check from 'telegram/func/check'

const userAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['userTId'])
  if (checkData) return checkData

  const user = await Users.findOne({ telegramId: jsonCommand.userTId })
  const teamsUser = await TeamsUsers.find({
    userTelegramId: jsonCommand.userTId,
  })
  const teamsIds = teamsUser.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  }).lean()

  return {
    message: `<b>"${user.name}"</b>\nСостоит в ${getNoun(
      teams?.length,
      'команде',
      'командах',
      'командах'
    )}${
      teams.length > 0
        ? `:\n${teams
            .map(({ _id, name }) => {
              const teamUser = teamsUser.find(
                ({ teamId }) => teamId === String(_id)
              )
              return ` - ${name}${
                teamUser?.role === 'capitan' ? ' (капитан)' : ''
              }`
            })
            .join('\n')}`
        : ''
    }`,
    buttons: [
      ...teamsUser.map(({ _id, role, teamId }) => {
        const team = teams.find(({ _id }) => String(_id) === teamId)
        return {
          c: {
            c: 'delTeamUserAdmin2',
            teamUserId: String(_id),
          },
          text: `\u{1F4A3} Удалить из "${team.name}"`,
        }
      }),
      {
        text: '\u{1F517} Записать в команду',
        c: {
          c: 'userJoinToTeam',
          userTId: jsonCommand.userTId,
        },
      },
      {
        url: `t.me/+${user.phone}`,
        text: '\u{1F4AC} Написать в личку',
      },
      {
        c: 'allUsers',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default userAdmin
