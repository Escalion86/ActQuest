import { prepareRegularTeamName } from '@server/teamNameUniqueness'

const createTeamFunc = async (userTelegramId, jsonCommand, db, location) => {
  const nameFields = await prepareRegularTeamName({
    TeamsModel: db.model('Teams'),
    name: jsonCommand.name,
    location,
  })
  const team = await db.model('Teams').create({
    // captainId: userTelegramId,
    ...nameFields,
    description: jsonCommand.description ?? '',
  })
  await db.model('TeamsUsers').create({
    teamId: String(team._id),
    userTelegramId,
    role: 'captain',
  })
  return team
}

export default createTeamFunc
