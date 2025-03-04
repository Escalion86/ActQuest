const createTeamFunc = async (userTelegramId, jsonCommand, db) => {
  const team = await db.model('Teams').create({
    // capitanId: userTelegramId,
    name: jsonCommand.name,
    name_lowered: jsonCommand.name.toLowerCase(),
    description: jsonCommand.description ?? '',
  })
  await db.model('TeamsUsers').create({
    teamId: String(team._id),
    userTelegramId,
    role: 'capitan',
  })
  return team
}

export default createTeamFunc
