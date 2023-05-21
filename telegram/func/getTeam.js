const { default: Teams } = require('@models/Teams')

const getTeam = async (id) => {
  await dbConnect()
  return await Teams.findById(id)
}

export default getTeam
