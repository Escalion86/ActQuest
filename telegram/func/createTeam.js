import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'

const createTeam = async (userTelegramId, name, description) => {
  await dbConnect()
  const team = await Teams.create({
    // capitanId: userTelegramId,
    name,
    name_lowered: name.toLowerCase(),
    description: description ?? '',
  })
  await TeamsUsers.create({
    teamId: String(team._id),
    userTelegramId: telegramId,
    role: 'capitan',
  })
  return team
}

export default createTeam
