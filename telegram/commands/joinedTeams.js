import { MAX_TEAMS } from 'telegram/constants'

const joinedTeams = async ({ telegramId, jsonCommand, location, db }) => {
  const teamsUser = await db
    .model('TeamsUsers')
    .find({ userTelegramId: telegramId })
  if (!teamsUser || teamsUser.length === 0) {
    return {
      message: 'Вы не состоите ни в какой команде',
      nextCommand: `menuTeams`,
    }
  }
  const teamsIds = teamsUser.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.teamId
  )

  const teams = await db.model('Teams').find({
    _id: { $in: teamsIds },
  })

  return {
    message:
      '<b>Мои команды</b>\n\n<i>* Примечание: нельзя состоять более чем в ТРЕХ командах</i>',
    buttons: [
      ...teams.map((team) => {
        const teamUser = teamsUser.find((teamUser) => {
          return teamUser.teamId === String(team._id)
        })
        // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
        return {
          text: `"${team.name}"${
            teamUser.role === 'capitan' ? ' (вы капитан)' : ''
          }`,
          c: { c: 'editTeam', teamId: team._id },
          //`editTeam/teamId=${team._id}`,
        }
      }),
      {
        c: teamsUser.length < MAX_TEAMS ? 'menuTeams' : 'mainMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default joinedTeams
