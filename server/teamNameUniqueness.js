export const TEAM_NAME_CONFLICT_CODE = 'team_name_conflict'
export const TEAM_NAME_CONFLICT_MESSAGE =
  'В этом городе уже есть команда с таким названием. Выберите другое название.'

const INDEX_NAME = 'regular_team_name_key_unique'
const indexPromises = new WeakMap()

const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const isTeamNameConflict = (error) =>
  error?.code === TEAM_NAME_CONFLICT_CODE ||
  (error?.code === 11000 &&
    (error?.keyPattern?.nameKey === 1 ||
      Boolean(error?.message?.includes(INDEX_NAME))))

export const teamNameConflictResponse = () => ({
  success: false,
  code: TEAM_NAME_CONFLICT_CODE,
  error: TEAM_NAME_CONFLICT_MESSAGE,
})

const ensureNameIndex = async (collection) => {
  if (!indexPromises.has(collection)) {
    const promise = collection.createIndex(
      { nameKey: 1 },
      {
        name: INDEX_NAME,
        unique: true,
        partialFilterExpression: { nameKey: { $type: 'string' } },
      },
    ).catch((error) => {
      indexPromises.delete(collection)
      throw error
    })
    indexPromises.set(collection, promise)
  }
  await indexPromises.get(collection)
}

export const prepareRegularTeamName = async ({
  TeamsModel,
  name,
  location,
  teamId,
}) => {
  const normalizedName = typeof name === 'string' ? name.trim().slice(0, 120) : ''
  const normalizedLocation = normalizeLocation(location)
  if (!normalizedName || !normalizedLocation) {
    throw new Error('Не указаны название или город команды')
  }

  // Старые команды проверяются по имени, даже если поисковое поле устарело.
  // Отдельный ключ позволяет включить защиту без изменения старых дублей.
  await ensureNameIndex(TeamsModel.collection)
  const duplicate = await TeamsModel.exists({
    kind: { $ne: 'personal' },
    location: new RegExp(`^\\s*${escapeRegex(normalizedLocation)}\\s*$`, 'i'),
    name: new RegExp(`^\\s*${escapeRegex(normalizedName)}\\s*$`, 'i'),
    ...(teamId ? { _id: { $ne: teamId } } : {}),
  })
  if (duplicate) {
    const error = new Error(TEAM_NAME_CONFLICT_MESSAGE)
    error.code = TEAM_NAME_CONFLICT_CODE
    throw error
  }

  return {
    name: normalizedName,
    name_lowered: normalizedName.toLowerCase(),
    location: normalizedLocation,
    nameKey: JSON.stringify([normalizedLocation, normalizedName.toLowerCase()]),
  }
}
