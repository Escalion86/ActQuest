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
  const normalizedTelegramId = normalizeNumber(telegramId)
  const normalizedVkId = normalizeNumber(vkId)
  const normalizedPhone = normalizeNumber(phone)

  const filters = buildIdentityFilters({
    telegramId: normalizedTelegramId,
    vkId: normalizedVkId,
    phone: normalizedPhone,
  })

  let existingUser = null
  if (filters.length > 0) {
    existingUser = await Users.findOne({ $or: filters }).lean()
  }

  const identityUpdates = {}
  if (normalizedTelegramId !== null) identityUpdates.telegramId = normalizedTelegramId
  if (normalizedVkId !== null) identityUpdates.vkId = normalizedVkId
  if (normalizedPhone !== null) identityUpdates.phone = normalizedPhone

  const updatePayload = { ...updates, ...identityUpdates }
  if (authMethod) updatePayload.authMethod = authMethod

  const identityDefaults = {
    telegramId: normalizedTelegramId,
    vkId: normalizedVkId,
    phone: normalizedPhone,
  }

  // Mongo не позволяет обновлять один и тот же путь одновременно в $set и $setOnInsert.
  const setOnInsertPayload = {
    ...identityDefaults,
    location: null,
    role: 'client',
    ...setOnInsert,
  }

  Object.keys(updatePayload).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(setOnInsertPayload, key)) {
      delete setOnInsertPayload[key]
    }
  })

  const user = await Users.findOneAndUpdate(
    existingUser ? { _id: existingUser._id } : filters[0] || { _id: null },
    {
      $set: updatePayload,
      $setOnInsert: setOnInsertPayload,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()

  return user
}

export default upsertGlobalUser
