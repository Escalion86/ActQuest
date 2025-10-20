const ensureString = (value, fallback = '') => {
  if (typeof value === 'string') {
    return value
  }

  if (value === null || value === undefined) {
    return fallback
  }

  if (typeof value.toString === 'function') {
    const result = value.toString()
    return result === '[object Object]' ? fallback : result
  }

  return fallback
}

const ensureNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const ensureBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === null || value === undefined) {
    return fallback
  }

  if (value === 'true') return true
  if (value === 'false') return false

  return Boolean(value)
}

const ensureDateISOString = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

const normalizePrices = (prices = []) => {
  if (!Array.isArray(prices) || prices.length === 0) {
    return []
  }

  return prices.map((price, index) => ({
    id: ensureString(price?.id, `price-${index}`),
    name: ensureString(price?.name, ''),
    price: ensureNumber(price?.price, 0),
  }))
}

const normalizeFinances = (finances = []) => {
  if (!Array.isArray(finances) || finances.length === 0) {
    return []
  }

  return finances.map((entry, index) => ({
    id: ensureString(entry?.id, `finance-${index}`),
    type: entry?.type === 'expense' ? 'expense' : 'income',
    sum: ensureNumber(entry?.sum, 0),
    date: ensureDateISOString(entry?.date),
    description: ensureString(entry?.description, ''),
  }))
}

const normalizeManyCodesPenalty = (value) => {
  if (!Array.isArray(value) || value.length < 2) {
    return [0, 0]
  }

  return [ensureNumber(value[0], 0), ensureNumber(value[1], 0)]
}

const computeTasksStats = (tasks = []) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { total: 0, bonus: 0, canceled: 0 }
  }

  return tasks.reduce(
    (acc, task) => {
      if (task?.canceled) {
        acc.canceled += 1
        return acc
      }

      if (task?.isBonusTask) {
        acc.bonus += 1
      } else {
        acc.total += 1
      }

      return acc
    },
    { total: 0, bonus: 0, canceled: 0 }
  )
}

const normalizeGameForCabinet = (game) => {
  if (!game) {
    return null
  }

  const id = ensureString(game._id ?? game.id)
  const tasksStats = computeTasksStats(game.tasks)

  return {
    id,
    name: ensureString(game.name, ''),
    status: ensureString(game.status, 'active'),
    dateStart: ensureDateISOString(game.dateStart),
    dateStartFact: ensureDateISOString(game.dateStartFact),
    dateEndFact: ensureDateISOString(game.dateEndFact),
    type: game?.type === 'photo' ? 'photo' : 'classic',
    description: ensureString(game.description, ''),
    image: ensureString(game.image, ''),
    startingPlace: ensureString(game.startingPlace, ''),
    finishingPlace: ensureString(game.finishingPlace, ''),
    taskDuration: ensureNumber(game.taskDuration, 3600),
    cluesDuration: ensureNumber(game.cluesDuration, 1200),
    clueEarlyAccessMode: game?.clueEarlyAccessMode === 'penalty' ? 'penalty' : 'time',
    clueEarlyPenalty: ensureNumber(game.clueEarlyPenalty, 0),
    allowCaptainForceClue: ensureBoolean(game.allowCaptainForceClue, true),
    allowCaptainFailTask: ensureBoolean(game.allowCaptainFailTask, true),
    allowCaptainFinishBreak: ensureBoolean(game.allowCaptainFinishBreak, true),
    breakDuration: ensureNumber(game.breakDuration, 0),
    taskFailurePenalty: ensureNumber(game.taskFailurePenalty, 0),
    manyCodesPenalty: normalizeManyCodesPenalty(game.manyCodesPenalty),
    individualStart: ensureBoolean(game.individualStart, false),
    hidden: ensureBoolean(game.hidden, true),
    showCreator: ensureBoolean(game.showCreator, true),
    showTasks: ensureBoolean(game.showTasks, false),
    hideResult: ensureBoolean(game.hideResult, false),
    prices: normalizePrices(game.prices),
    finances: normalizeFinances(game.finances),
    teamsCount: ensureNumber(game.teamsCount, 0),
    tasksStats,
    updatedAt: ensureDateISOString(game.updatedAt),
    createdAt: ensureDateISOString(game.createdAt),
    creatorTelegramId: ensureString(game.creatorTelegramId, ''),
  }
}

export default normalizeGameForCabinet
