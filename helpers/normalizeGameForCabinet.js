import { ensureDateISOString } from './idAndDate.js'
import {
  buildDefaultPrequel,
  normalizePrequelProgress,
  normalizePrequelConfig,
} from './normalizePrequel.js'
import {
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionMode,
} from './taskDistribution.js'

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

const normalizeGameType = (value) => {
  const normalized = ensureString(value, 'classic').trim().toLowerCase()
  return ['classic', 'photo', 'story'].includes(normalized)
    ? normalized
    : 'classic'
}

const normalizeStringArray = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) {
    return []
  }

  return values
    .map((item) => ensureString(item, '').trim())
    .filter((item) => item !== '')
}

const decodeHtmlEntities = (value) => {
  let result = ensureString(value, '')
  for (let index = 0; index < 3; index += 1) {
    const decoded = result
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
    if (decoded === result) {
      break
    }
    result = decoded
  }
  return result
}

const normalizeMediaUrl = (value) => {
  const prepared = decodeHtmlEntities(value).trim()
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
        item?.type === 'audio'
          ? 'audio'
          : item?.type === 'video'
            ? 'video'
            : 'image',
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
    image: normalizeMediaUrl(penaltyCode?.image),
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
    image: normalizeMediaUrl(bonusCode?.image),
  }))
}

const normalizeStoryMedia = (media = []) => normalizeTaskMedia(media)

const normalizeStoryItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return []
  }

  return items.map((item, index) => ({
    id: ensureString(item?.id, `story-item-${index}`),
    title: ensureString(item?.title, ''),
    image: normalizeMediaUrl(item?.image),
    descriptionRich: ensureString(item?.descriptionRich, ''),
    media: normalizeStoryMedia(item?.media),
    position: {
      x: ensureNumber(item?.position?.x, 0),
      y: ensureNumber(item?.position?.y, 0),
    },
    consumableOnUse: ensureBoolean(item?.consumableOnUse, false),
    hiddenUntilObtained: ensureBoolean(item?.hiddenUntilObtained, true),
  }))
}

const normalizeStoryNodes = (nodes = []) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return []
  }

  return nodes.map((node, index) => ({
    id: ensureString(node?.id, `story-node-${index}`),
    title: ensureString(node?.title, ''),
    descriptionRich: ensureString(node?.descriptionRich, ''),
    media: normalizeStoryMedia(node?.media),
    visibility: {
      startVisible: ensureBoolean(node?.visibility?.startVisible, false),
      requiredNodeIds: normalizeStringArray(node?.visibility?.requiredNodeIds),
      requiredItemIds: normalizeStringArray(node?.visibility?.requiredItemIds),
      requiredInputMode: ['any', 'count'].includes(
        node?.visibility?.requiredInputMode,
      )
        ? node.visibility.requiredInputMode
        : 'all',
      requiredInputCount: Math.max(
        1,
        Math.trunc(ensureNumber(node?.visibility?.requiredInputCount, 1)),
      ),
      hiddenUntilUnlocked: ensureBoolean(
        node?.visibility?.hiddenUntilUnlocked,
        true,
      ),
    },
    scoring: {
      scoreForComplete: ensureNumber(node?.scoring?.scoreForComplete, 0),
    },
    agentUserIds: normalizeStringArray(node?.agentUserIds),
    clues: Array.isArray(node?.clues) ? node.clues : [],
    codes: Array.isArray(node?.codes) ? node.codes : [],
    actions: Array.isArray(node?.actions) ? node.actions : [],
    position: {
      x: ensureNumber(node?.position?.x, 0),
      y: ensureNumber(node?.position?.y, 0),
    },
  }))
}

const normalizeStoryEdges = (edges = []) => {
  if (!Array.isArray(edges) || edges.length === 0) {
    return []
  }

  return edges.map((edge, index) => ({
    id: ensureString(edge?.id, `story-edge-${index}`),
    fromNodeId: ensureString(edge?.fromNodeId, ''),
    fromItemId: ensureString(edge?.fromItemId, ''),
    toNodeId: ensureString(edge?.toNodeId, ''),
    type: [
      'required_node',
      'required_item',
      'unlock',
      'requires_item',
      'ending',
    ].includes(edge?.type)
      ? edge.type
      : 'unlock',
    itemId: ensureString(edge?.itemId, ''),
    actionId: ensureString(edge?.actionId, ''),
    codeId: ensureString(edge?.codeId, ''),
  }))
}

const normalizeStoryEndings = (endings = []) => {
  if (!Array.isArray(endings) || endings.length === 0) {
    return []
  }

  return endings.map((ending, index) => ({
    id: ensureString(ending?.id, `story-ending-${index}`),
    title: ensureString(ending?.title, ''),
    type: ['success', 'failed', 'neutral', 'secret'].includes(ending?.type)
      ? ending.type
      : 'success',
    descriptionRich: ensureString(ending?.descriptionRich, ''),
    media: normalizeStoryMedia(ending?.media),
    position: {
      x: ensureNumber(ending?.position?.x, 420 + index * 48),
      y: ensureNumber(ending?.position?.y, 140 + index * 88),
    },
    conditions: {
      minScore: ensureNullableNumber(ending?.conditions?.minScore),
      requiredItemIds: normalizeStringArray(ending?.conditions?.requiredItemIds),
      requiredCompletedNodeIds: normalizeStringArray(
        ending?.conditions?.requiredCompletedNodeIds,
      ),
    },
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

const normalizeAgents = (agents = []) => {
  if (!Array.isArray(agents) || agents.length === 0) {
    return []
  }

  const seen = new Set()
  return agents
    .map((agent) => {
      const userSource =
        agent?.user && typeof agent.user === 'object' ? agent.user : agent
      const id = ensureString(
        agent?.userId ?? userSource?._id ?? userSource?.id,
        '',
      )

      if (!id || seen.has(id)) {
        return null
      }

      seen.add(id)

      return {
        userId: id,
        id,
        active: ensureBoolean(agent?.active, true),
        name: ensureString(userSource?.name, ''),
        username: ensureString(userSource?.username, ''),
        telegramId: ensureString(userSource?.telegramId, ''),
      }
    })
    .filter(Boolean)
}

const normalizeAgentNotifications = (value = {}) => ({
  onPreviousTask: ensureBoolean(value?.onPreviousTask, true),
  onCurrentTask: ensureBoolean(value?.onCurrentTask, true),
  onTaskCompleted: ensureBoolean(value?.onTaskCompleted, false),
  onAllTeamsPassed: ensureBoolean(value?.onAllTeamsPassed, true),
})

const normalizeCreator = (creator) => {
  if (!creator || typeof creator !== 'object') {
    return null
  }

  const id = ensureString(creator?._id ?? creator?.id, '')
  const name = ensureString(creator?.name, '')
  const username = ensureString(creator?.username, '')
  const phone = ensureString(creator?.phone, '')
  const telegramId = ensureString(creator?.telegramId, '')

  if (!id && !name && !username && !phone && !telegramId) {
    return null
  }

  return {
    id: id || null,
    name,
    username,
    phone,
    telegramId,
  }
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
        gameTeamId: ensureString(team?.gameTeamId, ''),
        teamName: ensureString(team?.teamName ?? team?.name, ''),
        isCaptain: ensureBoolean(team?.isCaptain, false),
        prequelProgress:
          team?.prequelProgress && typeof team.prequelProgress === 'object'
            ? normalizePrequelProgress(team.prequelProgress)
            : null,
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

  return tasks.map((task, index) => {
    const normalizedCodes = normalizeStringArray(task?.codes)
    const normalizedCodePhotos = normalizeStringArray(task?.codePhotos).slice(
      0,
      normalizedCodes.length,
    )

    return {
    id: ensureString(task?._id ?? task?.id, `task-${index}`),
    mongoId: task?._id ? ensureString(task._id) : null,
    title: ensureString(task?.title, ''),
    task: ensureString(task?.task, ''),
    howToSolve: ensureString(task?.howToSolve, ''),
    taskRich: ensureString(task?.taskRich, ''),
    taskMedia: normalizeTaskMedia(task?.taskMedia),
    taskBonusForComplite: ensureNumber(task?.taskBonusForComplite, 0),
    clues: normalizeClues(task?.clues),
    subTasks: normalizeSubTasks(task?.subTasks),
    images: normalizeStringArray(task?.images),
    codes: normalizedCodes,
    codePhotos: normalizedCodePhotos,
    coordinates: normalizeCoordinates(task?.coordinates),
    penaltyCodes: normalizePenaltyCodes(task?.penaltyCodes),
    bonusCodes: normalizeBonusCodes(task?.bonusCodes),
    numCodesToCompliteTask: ensureNullableNumber(task?.numCodesToCompliteTask),
    postMessage: ensureString(task?.postMessage, ''),
    postMessageRich: ensureString(task?.postMessageRich, ''),
    postMessageMedia: normalizeTaskMedia(task?.postMessageMedia),
    canceled: ensureBoolean(task?.canceled, false),
    isBonusTask: ensureBoolean(task?.isBonusTask, false),
    agentUserIds: normalizeStringArray(task?.agentUserIds),
    }
  })
}

const normalizePrequelForCabinet = (prequel) => ({
  ...buildDefaultPrequel(),
  ...normalizePrequelConfig(prequel),
})

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
    { total: 0, bonus: 0, canceled: 0 },
  )
}

const normalizeTasksStats = (tasksStats, tasks) => {
  if (!tasksStats || typeof tasksStats !== 'object') {
    return computeTasksStats(tasks)
  }

  return {
    total: ensureNumber(tasksStats.total, 0),
    bonus: ensureNumber(tasksStats.bonus, 0),
    canceled: ensureNumber(tasksStats.canceled, 0),
  }
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
  const tasksStats = normalizeTasksStats(game.tasksStats, game.tasks)
  const normalizedUserParticipationTeams = normalizeUserParticipationTeams(
    game.userParticipationTeams,
  )

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
    type: normalizeGameType(game?.type),
    storyConfig: {
      nodeLabel: ensureString(game?.storyConfig?.nodeLabel, 'Локация'),
      startMode:
        game?.storyConfig?.startMode === 'individual' ? 'individual' : 'common',
      hideTotalNodes: ensureBoolean(game?.storyConfig?.hideTotalNodes, true),
      hideTotalItems: ensureBoolean(game?.storyConfig?.hideTotalItems, true),
      showInventory: ensureBoolean(game?.storyConfig?.showInventory, true),
      showScoreToTeam: ensureBoolean(game?.storyConfig?.showScoreToTeam, false),
      showFinalHistoryToTeam: ensureBoolean(
        game?.storyConfig?.showFinalHistoryToTeam,
        false,
      ),
    },
    storyItems: normalizeStoryItems(game.storyItems),
    storyNodes: normalizeStoryNodes(game.storyNodes),
    storyEdges: normalizeStoryEdges(game.storyEdges),
    storyEndings: normalizeStoryEndings(game.storyEndings),
    description: ensureString(game.description, ''),
    descriptionRich: ensureString(game.descriptionRich, ''),
    descriptionMedia: normalizeTaskMedia(game.descriptionMedia),
    prequel: normalizePrequelForCabinet(game.prequel),
    image: normalizeMediaUrl(game.image),
    startingPlace: ensureString(game.startingPlace, ''),
    finishingPlace: ensureString(game.finishingPlace, ''),
    showFinishingPlace: ensureBoolean(game.showFinishingPlace, false),
    taskDuration: ensureNumber(game.taskDuration, 3600),
    cluesDuration: ensureNumber(game.cluesDuration, 1200),
    clueEarlyAccessMode:
      game?.clueEarlyAccessMode === 'penalty' ? 'penalty' : 'time',
    clueEarlyPenalty: ensureNumber(game.clueEarlyPenalty, 0),
    allowCaptainForceClue: ensureBoolean(game.allowCaptainForceClue, true),
    clueEarlyAccessFrom: Math.max(
      1,
      Math.trunc(ensureNumber(game.clueEarlyAccessFrom, 1)),
    ),
    allowCaptainFailTask: ensureBoolean(game.allowCaptainFailTask, true),
    allowCaptainFinishBreak: ensureBoolean(game.allowCaptainFinishBreak, true),
    breakDuration: ensureNumber(game.breakDuration, 0),
    taskFailurePenalty: ensureNumber(game.taskFailurePenalty, 0),
    manyCodesPenalty: normalizeManyCodesPenalty(game.manyCodesPenalty),
    taskDistributionMode: normalizeTaskDistributionMode(
      game.taskDistributionMode,
    ),
    taskDistributionTemplate: normalizeStoredTaskDistributionTemplate(
      game.taskDistributionTemplate,
      Array.isArray(game.tasks) ? game.tasks.length : 0,
    ),
    individualStart: ensureBoolean(game.individualStart, false),
    isRated: ensureBoolean(game.isRated, true),
    hidden: ensureBoolean(game.hidden, true),
    showCreator: ensureBoolean(game.showCreator, true),
    showEnterButton: ensureBoolean(game.showEnterButton, false),
    showTasks: ensureBoolean(game.showTasks, false),
    showTasksAudience:
      game.showTasksAudience === 'participants' ? 'participants' : 'all',
    showTasksCountInGame: ensureBoolean(game.showTasksCountInGame, false),
    hideResult: ensureBoolean(game.hideResult, false),
    registrationOpen: ensureBoolean(game.registrationOpen, true),
    maxTeamPlayers: ensureNullableNumber(game.maxTeamPlayers),
    prices: normalizePrices(game.prices),
    finances: normalizeFinances(game.finances),
    tasks: normalizeTasks(game.tasks),
    teamsCount: ensureNumber(game.teamsCount, 0),
    adminUnreadMessagesCount: ensureNumber(game.adminUnreadMessagesCount, 0),
    userTeamPlace: ensureNullableNumber(game.userTeamPlace),
    userParticipationTeams: normalizedUserParticipationTeams,
    teams: normalizedUserParticipationTeams.map((t) => t.teamName),
    tasksStats,
    isResultGenerated: isResultGenerated(game.result),
    updatedAt: ensureDateISOString(game.updatedAt),
    createdAt: ensureDateISOString(game.createdAt),
    creatorUserId: ensureString(game.creatorUserId, ''),
    creatorTelegramId: ensureString(game.creatorTelegramId, ''),
    creator: normalizeCreator(game.creator),
    moderators: normalizeModerators(game.moderators),
    agents: normalizeAgents(game.agents),
    agentNotifications: normalizeAgentNotifications(game.agentNotifications),
  }
}

export default normalizeGameForCabinet
