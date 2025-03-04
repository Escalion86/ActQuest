const getAdmins = async (db) =>
  await db
    .model('Users')
    .find({ $or: [{ role: 'admin' }, { role: 'dev' }] })
    .lean()

export default getAdmins
