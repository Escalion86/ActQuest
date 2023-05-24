import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'

const joined_teams = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })
  if (!teamsUser || teamsUser.length === 0) {
    return {
      message: 'Вы не состоите ни в какой команде',
      nextCommand: `menu_teams`,
    }
  }
  const teamsIds = teamsUser.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  return {
    message: 'Команды в которых я состою',
    buttons: [
      ...teams.map((team) => {
        const teamUser = teamsUser.find((teamUser) => {
          return teamUser.teamId === String(team._id)
        })
        // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
        return {
          text: `"${team.name}"${
            teamUser.role === 'capitan' ? ' (Капитан)' : ''
          }`,
          cmd: { cmd: 'edit_team', teamId: team._id },
          //`edit_team/teamId=${team._id}`,
        }
      }),
      { cmd: 'menu_teams', text: '\u{2B05} Назад' },
    ],
  }
}

export default joined_teams
