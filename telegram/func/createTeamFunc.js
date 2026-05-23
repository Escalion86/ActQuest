const createTeamFunc = async (userTelegramId, jsonCommand, db) => {
  const team = await db.model('Teams').create({
    // captainId: userTelegramId,
    name: jsonCommand.name,
    name_lowered: jsonCommand.name.toLowerCase(),
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
