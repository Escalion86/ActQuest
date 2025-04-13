import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const teams = async ({ telegramId, jsonCommand, location, db }) => {
  const teams = await db.model('Teams').find({}).lean()
  const teamsUsers = await db.model('TeamsUsers').find({}).lean()

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
        page,
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
