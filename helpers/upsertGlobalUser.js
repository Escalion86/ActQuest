import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeNumber = (value) => {
  if (value === null || typeof value === 'undefined') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const buildIdentityFilters = ({ telegramId, vkId, phone }) => {
  const filters = []

  const normalizedTelegramId = normalizeNumber(telegramId)
  const normalizedVkId = normalizeNumber(vkId)
  const normalizedPhone = normalizeNumber(phone)

  if (normalizedPhone !== null) filters.push({ phone: normalizedPhone })
  if (normalizedVkId !== null) filters.push({ vkId: normalizedVkId })
  if (normalizedTelegramId !== null) filters.push({ telegramId: normalizedTelegramId })

  return filters
}

const upsertGlobalUser = async ({
  telegramId = null,
  vkId = null,
  phone = null,
  updates = {},
  authMethod = null,
  setOnInsert = {},
}) => {
  const db = await dbConnectGlobal()
  if (!db) return null

  const Users = db.model('Users')
  const filters = buildIdentityFilters({ telegramId, vkId, phone })

  let existingUser = null
  if (filters.length > 0) {
    existingUser = await Users.findOne({ $or: filters }).lean()
  }

  const updatePayload = { ...updates }
  if (authMethod) updatePayload.authMethod = authMethod

  const identityDefaults = {
    telegramId: normalizeNumber(telegramId),
    vkId: normalizeNumber(vkId),
    phone: normalizeNumber(phone),
  }

  const user = await Users.findOneAndUpdate(
    existingUser ? { _id: existingUser._id } : filters[0] || { _id: null },
    {
      $set: updatePayload,
      $setOnInsert: {
        ...identityDefaults,
        location: null,
        role: 'client',
        ...setOnInsert,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()

  return user
}

export default upsertGlobalUser
