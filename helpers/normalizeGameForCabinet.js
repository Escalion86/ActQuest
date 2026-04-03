import { ensureDateISOString } from '@helpers/idAndDate'

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

const ensureNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
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

const normalizeStringArray = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) {
    return []
  }

  return values
    .map((item) => ensureString(item, '').trim())
    .filter((item) => item !== '')
}

const normalizeMediaUrl = (value) => {
  const prepared = ensureString(value, '').trim()
  if (!prepared) {
    return ''
  }

  if (
    prepared.startsWith('/') ||
    /^https?:\/\//i.test(prepared) ||
    /^data:/i.test(prepared) ||
    /^blob:/i.test(prepared)
  ) {
    return prepared
  }

  // Отбрасываем raw file_id и прочие не-URL значения (например Telegram file_id),
  // чтобы браузер не пытался открыть их как относительный путь "/cabinet/...".
  if (!prepared.includes('/') && !prepared.includes('.')) {
    return ''
  }

  if (/^[a-z0-9/_\-.]+$/i.test(prepared)) {
    return `/${prepared.replace(/^\/+/, '')}`
  }

  return ''
}

const normalizeTaskMedia = (media = []) => {
  if (!Array.isArray(media) || media.length === 0) {
    return []
  }

  return media
    .map((item, index) => ({
      id: ensureString(item?.id, `task-media-${index}`),
      type:
        item?.type === 'audio' ? 'audio' : item?.type === 'video' ? 'video' : 'image',
      url: normalizeMediaUrl(item?.url),
      mime: ensureString(item?.mime, ''),
      size: ensureNumber(item?.size, 0),
      duration: ensureNumber(item?.duration, 0),
      path: ensureString(item?.path, ''),
      title: ensureString(item?.title, ''),
    }))
    .filter((item) => item.url !== '')
}

const normalizeClues = (clues = []) => {
  if (!Array.isArray(clues) || clues.length === 0) {
    return []
  }

  return clues.map((clue, index) => ({
    id: ensureString(clue?._id ?? clue?.id, `clue-${index}`),
    mongoId: clue?._id ? ensureString(clue._id) : null,
    clue: ensureString(clue?.clue, ''),
    clueRich: ensureString(clue?.clueRich, ''),
    images: normalizeStringArray(clue?.images),
  }))
}

const normalizeSubTasks = (subTasks = []) => {
  if (!Array.isArray(subTasks) || subTasks.length === 0) {
    return []
  }

  return subTasks.map((subTask, index) => ({
    id: ensureString(subTask?._id ?? subTask?.id, `subtask-${index}`),
    mongoId: subTask?._id ? ensureString(subTask._id) : null,
    name: ensureString(subTask?.name, ''),
    task: ensureString(subTask?.task, ''),
    bonus: ensureNumber(subTask?.bonus, 0),
  }))
}

const normalizePenaltyCodes = (penaltyCodes = []) => {
  if (!Array.isArray(penaltyCodes) || penaltyCodes.length === 0) {
    return []
  }

  return penaltyCodes.map((penaltyCode, index) => ({
    id: ensureString(penaltyCode?._id ?? penaltyCode?.id, `penalty-${index}`),
    mongoId: penaltyCode?._id ? ensureString(penaltyCode._id) : null,
    code: ensureString(penaltyCode?.code, ''),
    penalty: ensureNumber(penaltyCode?.penalty, 0),
    description: ensureString(penaltyCode?.description, ''),
  }))
}

const normalizeBonusCodes = (bonusCodes = []) => {
  if (!Array.isArray(bonusCodes) || bonusCodes.length === 0) {
    return []
  }

  return bonusCodes.map((bonusCode, index) => ({
    id: ensureString(bonusCode?._id ?? bonusCode?.id, `bonus-${index}`),
    mongoId: bonusCode?._id ? ensureString(bonusCode._id) : null,
    code: ensureString(bonusCode?.code, ''),
    bonus: ensureNumber(bonusCode?.bonus, 0),
    description: ensureString(bonusCode?.description, ''),
  }))
}

const normalizeModerators = (moderators = []) => {
  if (!Array.isArray(moderators) || moderators.length === 0) {
    return []
  }

  return moderators
    .map((moderator) => {
      const id = ensureString(moderator?._id ?? moderator?.id, '')

      if (!id) {
        return null
      }

      return {
        id,
        name: ensureString(moderator?.name, ''),
        username: ensureString(moderator?.username, ''),
        telegramId: ensureString(moderator?.telegramId, ''),
      }
    })
    .filter(Boolean)
}

const normalizeUserParticipationTeams = (teams = []) => {
  if (!Array.isArray(teams) || teams.length === 0) {
    return []
  }

  return teams
    .map((team) => {
      const teamId = ensureString(team?.teamId ?? team?.id, '')
      if (!teamId) {
        return null
      }

      return {
        teamId,
        teamName: ensureString(team?.teamName ?? team?.name, ''),
        isCaptain: ensureBoolean(team?.isCaptain, false),
      }
    })
    .filter(Boolean)
}

const normalizeCoordinates = (coordinates) => {
  if (!coordinates || typeof coordinates !== 'object') {
    return { latitude: null, longitude: null, radius: null }
  }

  return {
    latitude: ensureNullableNumber(coordinates.latitude),
    longitude: ensureNullableNumber(coordinates.longitude),
    radius: ensureNullableNumber(coordinates.radius),
  }
}

const normalizeTasks = (tasks = []) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return []
  }

  return tasks.map((task, index) => ({
    id: ensureString(task?._id ?? task?.id, `task-${index}`),
    mongoId: task?._id ? ensureString(task._id) : null,
    title: ensureString(task?.title, ''),
    task: ensureString(task?.task, ''),
    taskRich: ensureString(task?.taskRich, ''),
    taskMedia: normalizeTaskMedia(task?.taskMedia),
    taskBonusForComplite: ensureNumber(task?.taskBonusForComplite, 0),
    clues: normalizeClues(task?.clues),
    subTasks: normalizeSubTasks(task?.subTasks),
    images: normalizeStringArray(task?.images),
    codes: normalizeStringArray(task?.codes),
    coordinates: normalizeCoordinates(task?.coordinates),
    penaltyCodes: normalizePenaltyCodes(task?.penaltyCodes),
    bonusCodes: normalizeBonusCodes(task?.bonusCodes),
    numCodesToCompliteTask: ensureNullableNumber(task?.numCodesToCompliteTask),
    postMessage: ensureString(task?.postMessage, ''),
    canceled: ensureBoolean(task?.canceled, false),
    isBonusTask: ensureBoolean(task?.isBonusTask, false),
  }))
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

const isResultGenerated = (result) => {
  if (!result || typeof result !== 'object') {
    return false
  }

  return Boolean(result.computed && typeof result.computed === 'object')
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
    location: ensureString(game.location, ''),
    seasonId: ensureString(game.seasonId, ''),
    seasonName: ensureString(game.seasonName, ''),
    type: game?.type === 'photo' ? 'photo' : 'classic',
    description: ensureString(game.description, ''),
    descriptionRich: ensureString(game.descriptionRich, ''),
    descriptionMedia: normalizeTaskMedia(game.descriptionMedia),
    image: normalizeMediaUrl(game.image),
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
    isRated: ensureBoolean(game.isRated, true),
    hidden: ensureBoolean(game.hidden, true),
    showCreator: ensureBoolean(game.showCreator, true),
    showTasks: ensureBoolean(game.showTasks, false),
    hideResult: ensureBoolean(game.hideResult, false),
    registrationOpen: ensureBoolean(game.registrationOpen, true),
    maxTeamPlayers: ensureNullableNumber(game.maxTeamPlayers),
    prices: normalizePrices(game.prices),
    finances: normalizeFinances(game.finances),
    tasks: normalizeTasks(game.tasks),
    teamsCount: ensureNumber(game.teamsCount, 0),
    userTeamPlace: ensureNullableNumber(game.userTeamPlace),
    userParticipationTeams: normalizeUserParticipationTeams(
      game.userParticipationTeams,
    ),
    tasksStats,
    isResultGenerated: isResultGenerated(game.result),
    updatedAt: ensureDateISOString(game.updatedAt),
    createdAt: ensureDateISOString(game.createdAt),
    creatorTelegramId: ensureString(game.creatorTelegramId, ''),
    moderators: normalizeModerators(game.moderators),
  }
}

export default normalizeGameForCabinet
