import Users from '@models/Users'

const getAdmins = async () =>
  await Users.find({ $or: [{ role: 'admin' }, { role: 'dev' }] }).lean()

export default getAdmins
