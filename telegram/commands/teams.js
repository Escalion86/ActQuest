import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'

const teams = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  const teams = await Teams.find({})
  const teamsUsers = await TeamsUsers.find({})

  return {
    message: '<b>Обзор всех команд</b>',
    buttons: [
      ...teams.map((team) => {
        const participansCount = teamsUsers.reduce(
          (p, c) => p + (c.teamId === String(team._id) ? 1 : 0),
          0
        )
        return {
          text: `"${team.name}" (${participansCount} чел)`,
          c: {
            c: 'editTeamAdmin',
            teamId: team._id,
            // p: 1,
          },
        }
      }),
      {
        c: 'mainMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default teams
