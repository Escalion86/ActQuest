import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'

import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const teams = async ({ telegramId, jsonCommand }) => {
  const teams = await Teams.find({})
  const teamsUsers = await TeamsUsers.find({})

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(teams, page, (team, number) => {
    const participansCount = teamsUsers.reduce(
      (p, c) => p + (c.teamId === String(team._id) ? 1 : 0),
      0
    )
    return {
      text: `${number}. "${team.name}" (${participansCount} чел)`,
      c: {
        c: 'editTeamAdmin',
        teamId: team._id,
        // p: 1,
      },
    }
  })

  return {
    message: '<b>Все команды</b>',
    buttons: [
      ...buttons,
      {
        c: 'adminMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default teams
