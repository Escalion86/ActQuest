const OMITTED_KEYS = new Set(['__v'])

const isBsonObjectIdLike = (value) =>
  value &&
  typeof value === 'object' &&
  (value?._bsontype === 'ObjectId' ||
    value?.constructor?.name === 'ObjectId' ||
    value?.constructor?.name === 'ObjectID')

const normalizeScalar = (value) => {
  if (value === undefined) {
    return null
  }

  if (value === null) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value?.toISOString === 'function') {
    try {
      const normalized = value.toISOString()
      return typeof normalized === 'string' ? normalized : null
    } catch {
      return null
    }
  }

  return null
}

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof Map)

const shouldStringifyLikeId = (value) => {
  if (!value || typeof value !== 'object') {
    return false
  }

  if (Array.isArray(value) || value instanceof Date || value instanceof Map) {
    return false
  }

  const keys = Object.keys(value)
  return (
    typeof value?.toString === 'function' &&
    (keys.length === 0 || (keys.length === 1 && keys[0] === 'toString'))
  )
}

const normalizeValue = (value) => {
  const scalar = normalizeScalar(value)
  if (scalar !== null || value === null || value === undefined) {
    return scalar
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item))
  }

  if (value instanceof Map) {
    return Array.from(value.entries())
      .sort(([leftKey], [rightKey]) =>
        String(leftKey?.toString?.() ?? leftKey).localeCompare(
          String(rightKey?.toString?.() ?? rightKey),
          'en',
        ),
      )
      .reduce((acc, [key, mapValue]) => {
        const normalizedKey = String(key?.toString?.() ?? key)
        acc[normalizedKey] = normalizeValue(mapValue)
        return acc
      }, {})
  }

  if (isBsonObjectIdLike(value)) {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? null : nextValue
  }

  if (shouldStringifyLikeId(value)) {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? null : nextValue
  }

  if (isPlainObject(value) || typeof value?.toObject === 'function') {
    const source =
      typeof value?.toObject === 'function' ? value.toObject() : value

    return Object.keys(source)
      .filter((key) => !OMITTED_KEYS.has(key))
      .sort((left, right) => left.localeCompare(right, 'en'))
      .reduce((acc, key) => {
        const normalizedChild = normalizeValue(source[key])
        if (normalizedChild !== undefined) {
          acc[key] = normalizedChild
        }
        return acc
      }, {})
  }

  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? null : nextValue
  }

  return null
}

const sortGameTeams = (gameTeams = []) =>
  [...gameTeams].sort((left, right) => {
    const leftTeamId = String(left?.teamId ?? '')
    const rightTeamId = String(right?.teamId ?? '')
    if (leftTeamId !== rightTeamId) {
      return leftTeamId.localeCompare(rightTeamId, 'en')
    }

    return String(left?._id ?? '')
      .localeCompare(String(right?._id ?? ''), 'en')
  })

const normalizeGameHistoryState = ({ game = null, gameTeams = [] } = {}) => ({
  game: game ? normalizeValue(game) : null,
  gameTeams: sortGameTeams(
    (Array.isArray(gameTeams) ? gameTeams : []).map((entry) =>
      normalizeValue(entry),
    ),
  ),
})

export default normalizeGameHistoryState
