const { default: Teams } = require('@models/Teams')
const { default: dbConnect } = require('@utils/dbConnect')

const createTeam = async (userTelegramId, name, description) => {
  await dbConnect()
  return await Teams.create({
    capitanId: userTelegramId,
    name,
    name_lowered: name.toLowerCase(),
    description: description ?? '',
  })
}

export default createTeam
