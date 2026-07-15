const PREQUEL_MODE_SINGLE_HIT = 'single_hit'
const PREQUEL_MODE_MULTI_HIT = 'multi_hit'
const PREQUEL_STATUS_COMPLETED = 'completed'
const PREQUEL_STATUS_OPEN = 'open'
const PREQUEL_STATUS_LOCKED = 'locked'
const LEGACY_PREQUEL_ID = 'legacy-prequel'

const PREQUEL_EFFECT_TYPES = [
  'grant_item',
  'unlock_node',
  'set_flag',
  'score_modifier',
]

const ensureString = (value, fallback = '') => {
  if (typeof value === 'string') {
    return value
  }

  if (value === null || value === undefined) {
    return fallback
  }

  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? fallback : nextValue
  }

  return fallback
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

const ensureNullableDateISOString = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

const normalizeStringArray = (values = []) =>
  (Array.isArray(values) ? values : [])
    .map((item) => ensureString(item, '').trim())
    .filter(Boolean)

const normalizeMediaItem = (item, index, prefix) => ({
  id: ensureString(item?.id, `${prefix}-${index}`).trim() || `${prefix}-${index}`,
  type:
    item?.type === 'audio'
      ? 'audio'
      : item?.type === 'video'
        ? 'video'
        : 'image',
  url: ensureString(item?.url, '').trim(),
  mime: ensureString(item?.mime, '').trim(),
  size: ensureNumber(item?.size, 0),
  duration: ensureNumber(item?.duration, 0),
  path: ensureString(item?.path, '').trim(),
  title: ensureString(item?.title, '').trim(),
})

const normalizePrequelStoryEffect = (effect, index = 0) => {
  const type = PREQUEL_EFFECT_TYPES.includes(effect?.type)
    ? effect.type
    : 'grant_item'

  return {
    id:
      ensureString(effect?.id, `prequel-effect-${index}`).trim() ||
      `prequel-effect-${index}`,
    type,
    itemId: ensureString(effect?.itemId, '').trim(),
    nodeId: ensureString(effect?.nodeId, '').trim(),
    flagKey: ensureString(effect?.flagKey, '').trim(),
    flagValue: ensureBoolean(effect?.flagValue, true),
    value: ensureNumber(effect?.value, 0),
    label: ensureString(effect?.label, '').trim(),
  }
}

const normalizePrequelCodeEntry = (entry, index = 0, kind = 'bonus') => {
  const valueKey = kind === 'penalty' ? 'penalty' : 'bonus'
  const fallbackId = `prequel-${kind}-${index}`
  const mongoId =
    entry?._id !== null && entry?._id !== undefined
      ? ensureString(entry._id, '').trim()
      : null

  return {
    id: ensureString(entry?.id, fallbackId).trim() || fallbackId,
    mongoId: mongoId || null,
    code: ensureString(entry?.code, ''),
    value: ensureNumber(
      entry?.value ?? entry?.[valueKey] ?? entry?.points ?? entry?.seconds,
      0,
    ),
    description: ensureString(entry?.description, ''),
    image: ensureString(entry?.image, '').trim(),
    storyEffects: (Array.isArray(entry?.storyEffects) ? entry.storyEffects : []).map(
      normalizePrequelStoryEffect,
    ),
  }
}

const normalizePrequelMainCodeEntry = (entry, index = 0) => {
  const normalizedEntry =
    typeof entry === 'string' || typeof entry === 'number'
      ? { code: String(entry) }
      : entry

  return normalizePrequelCodeEntry(normalizedEntry, index, 'main')
}

const normalizeCompletionBonus = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return {
    value: ensureNumber(source?.value ?? value, 0),
    description: ensureString(source?.description, '').trim(),
    storyEffects: (
      Array.isArray(source?.storyEffects) ? source.storyEffects : []
    ).map(normalizePrequelStoryEffect),
  }
}

const buildDefaultPrequel = () => ({
  id: '',
  title: '',
  enabled: false,
  openAt: null,
  description: '',
  descriptionRich: '',
  descriptionMedia: [],
  mode: PREQUEL_MODE_MULTI_HIT,
  mainCodesCount: 0,
  mainCodes: [],
  requiredMainCodesCount: null,
  completionBonus: normalizeCompletionBonus(null),
  bonusCodesCount: 0,
  penaltyCodesCount: 0,
  bonusCodes: [],
  penaltyCodes: [],
  wrongAttemptsLimit: null,
  wrongAttemptsPenalty: 0,
  wrongAttemptsStoryEffects: [],
})

const normalizePrequelConfig = (prequel, options = {}) => {
  const includeCodes = options.includeCodes !== false
  const nextPrequel = prequel && typeof prequel === 'object' ? prequel : {}
  const mode =
    nextPrequel?.mode === PREQUEL_MODE_SINGLE_HIT
      ? PREQUEL_MODE_SINGLE_HIT
      : PREQUEL_MODE_MULTI_HIT
  const rawBonusCodes = Array.isArray(nextPrequel?.bonusCodes)
    ? nextPrequel.bonusCodes
    : []
  const rawPenaltyCodes = Array.isArray(nextPrequel?.penaltyCodes)
    ? nextPrequel.penaltyCodes
    : []
  const rawMainCodes = Array.isArray(nextPrequel?.mainCodes)
    ? nextPrequel.mainCodes
    : []
  const normalizedMainCodes = rawMainCodes.map(normalizePrequelMainCodeEntry)
  const normalizedBonusCodes = rawBonusCodes.map((entry, index) =>
    normalizePrequelCodeEntry(entry, index, 'bonus'),
  )
  const normalizedPenaltyCodes = rawPenaltyCodes.map((entry, index) =>
    normalizePrequelCodeEntry(entry, index, 'penalty'),
  )
  const normalizedBonusCodesCount = normalizedBonusCodes.filter((entry) =>
    ensureString(entry?.code, '').trim(),
  ).length
  const normalizedPenaltyCodesCount = normalizedPenaltyCodes.filter((entry) =>
    ensureString(entry?.code, '').trim(),
  ).length
  const normalizedMainCodesCount = normalizedMainCodes.filter((entry) =>
    ensureString(entry?.code, '').trim(),
  ).length
  const effectiveBonusCodesCount =
    normalizedBonusCodesCount > 0
      ? normalizedBonusCodesCount
      : ensureNumber(nextPrequel?.bonusCodesCount, 0)
  const effectivePenaltyCodesCount =
    normalizedPenaltyCodesCount > 0
      ? normalizedPenaltyCodesCount
      : ensureNumber(nextPrequel?.penaltyCodesCount, 0)

  return {
    id: ensureString(nextPrequel?.id, options.fallbackId || '').trim(),
    title: ensureString(nextPrequel?.title, '').trim(),
    enabled: ensureBoolean(nextPrequel?.enabled, false),
    openAt: ensureNullableDateISOString(nextPrequel?.openAt),
    description: ensureString(nextPrequel?.description, ''),
    descriptionRich: ensureString(nextPrequel?.descriptionRich, ''),
    descriptionMedia: (Array.isArray(nextPrequel?.descriptionMedia)
      ? nextPrequel.descriptionMedia
      : []
    )
      .map((item, index) => normalizeMediaItem(item, index, 'prequel-media'))
      .filter((item) => item.url !== ''),
    mode,
    mainCodesCount:
      normalizedMainCodesCount > 0
        ? normalizedMainCodesCount
        : ensureNumber(nextPrequel?.mainCodesCount, 0),
    mainCodes: includeCodes ? normalizedMainCodes : [],
    requiredMainCodesCount: ensureNullableNumber(
      nextPrequel?.requiredMainCodesCount,
    ),
    completionBonus: normalizeCompletionBonus(nextPrequel?.completionBonus),
    bonusCodesCount: effectiveBonusCodesCount,
    penaltyCodesCount: effectivePenaltyCodesCount,
    bonusCodes: includeCodes ? normalizedBonusCodes : [],
    penaltyCodes: includeCodes ? normalizedPenaltyCodes : [],
    wrongAttemptsLimit: ensureNullableNumber(nextPrequel?.wrongAttemptsLimit),
    wrongAttemptsPenalty: ensureNumber(nextPrequel?.wrongAttemptsPenalty, 0),
    wrongAttemptsStoryEffects: (
      Array.isArray(nextPrequel?.wrongAttemptsStoryEffects)
        ? nextPrequel.wrongAttemptsStoryEffects
        : []
    ).map(normalizePrequelStoryEffect),
  }
}

const normalizePrequelConfigs = (value, options = {}) => {
  const rawItems = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : []

  return rawItems.map((item, index) => {
    const fallbackId =
      index === 0 && !Array.isArray(value)
        ? LEGACY_PREQUEL_ID
        : `prequel-${index + 1}`
    const normalized = normalizePrequelConfig(item, {
      ...options,
      fallbackId,
    })
    return {
      ...normalized,
      id: normalized.id || fallbackId,
      title: normalized.title || `Приквел ${index + 1}`,
    }
  })
}

const getGamePrequels = (game, options = {}) => {
  if (Array.isArray(game?.prequels) && game.prequels.length > 0) {
    return normalizePrequelConfigs(game.prequels, options)
  }
  if (game?.prequel && typeof game.prequel === 'object') {
    return normalizePrequelConfigs(game.prequel, options)
  }
  return []
}

const resolveRequiredPrequelMainCodesCount = (prequel) => {
  const normalized = normalizePrequelConfig(prequel, { includeCodes: false })
  const total = Math.max(0, Math.trunc(Number(normalized.mainCodesCount) || 0))
  if (total <= 0) return 0

  const requested = Number(normalized.requiredMainCodesCount)
  if (!Number.isInteger(requested) || requested < 1 || requested > total) {
    return total
  }
  return requested
}

const buildDefaultPrequelProgress = () => ({
  prequelId: '',
  foundMainCodes: [],
  foundBonusCodes: [],
  foundPenaltyCodes: [],
  wrongCodes: [],
  attempts: [],
  wrongPenaltyAppliedCount: 0,
  appliedAdjustments: [],
  appliedStoryEffects: [],
  isClosed: false,
  closedReason: null,
  completedAt: null,
  completedSource: null,
  completedByUserId: null,
  completionBonusApplied: false,
  lastSubmittedAt: null,
})

const normalizePrequelProgress = (progress) => {
  const nextProgress = progress && typeof progress === 'object' ? progress : {}

  return {
    prequelId: ensureString(nextProgress?.prequelId, '').trim(),
    foundMainCodes: normalizeStringArray(nextProgress?.foundMainCodes),
    foundBonusCodes: normalizeStringArray(nextProgress?.foundBonusCodes),
    foundPenaltyCodes: normalizeStringArray(nextProgress?.foundPenaltyCodes),
    wrongCodes: normalizeStringArray(nextProgress?.wrongCodes),
    attempts: (Array.isArray(nextProgress?.attempts) ? nextProgress.attempts : []).map(
      (attempt, index) => ({
        id:
          ensureString(attempt?.id, `prequel-attempt-${index}`).trim() ||
          `prequel-attempt-${index}`,
        code: ensureString(attempt?.code, ''),
        normalizedCode: ensureString(attempt?.normalizedCode, '').trim(),
        category: ['main', 'bonus', 'penalty'].includes(attempt?.category)
          ? attempt.category
          : 'wrong',
        matchedCode: ensureString(attempt?.matchedCode, ''),
        source: attempt?.source === 'admin' ? 'admin' : 'player',
        actorUserId: ensureString(attempt?.actorUserId, '').trim() || null,
        createdAt: attempt?.createdAt || null,
      }),
    ),
    wrongPenaltyAppliedCount: ensureNumber(
      nextProgress?.wrongPenaltyAppliedCount,
      0,
    ),
    appliedAdjustments: (
      Array.isArray(nextProgress?.appliedAdjustments)
        ? nextProgress.appliedAdjustments
        : []
    ).map((item, index) => ({
      id:
        ensureString(item?.id, `prequel-adjustment-${index}`).trim() ||
        `prequel-adjustment-${index}`,
      type: item?.type === 'bonus' ? 'bonus' : 'penalty',
      source:
        item?.source === 'completion_bonus'
          ? 'completion_bonus'
          : item?.source === 'wrong_attempts_limit'
          ? 'wrong_attempts_limit'
          : item?.source === 'penalty_code'
            ? 'penalty_code'
            : 'bonus_code',
      code: ensureString(item?.code, ''),
      codeId: ensureString(item?.codeId, '').trim(),
      value: ensureNumber(item?.value, 0),
      description: ensureString(item?.description, ''),
      createdAt: item?.createdAt || null,
    })),
    appliedStoryEffects: (
      Array.isArray(nextProgress?.appliedStoryEffects)
        ? nextProgress.appliedStoryEffects
        : []
    ).map((item, index) => ({
      id:
        ensureString(item?.id, `prequel-applied-effect-${index}`).trim() ||
        `prequel-applied-effect-${index}`,
      effectId: ensureString(item?.effectId, '').trim(),
      source:
        item?.source === 'completion_bonus'
          ? 'completion_bonus'
          : item?.source === 'wrong_attempts_limit'
          ? 'wrong_attempts_limit'
          : item?.source === 'penalty_code'
            ? 'penalty_code'
            : 'bonus_code',
      code: ensureString(item?.code, ''),
      type: PREQUEL_EFFECT_TYPES.includes(item?.type) ? item.type : 'grant_item',
      itemId: ensureString(item?.itemId, '').trim(),
      nodeId: ensureString(item?.nodeId, '').trim(),
      flagKey: ensureString(item?.flagKey, '').trim(),
      flagValue: ensureBoolean(item?.flagValue, true),
      value: ensureNumber(item?.value, 0),
      label: ensureString(item?.label, ''),
      appliedAt: item?.appliedAt || null,
    })),
    isClosed: ensureBoolean(nextProgress?.isClosed, false),
    closedReason: ensureString(nextProgress?.closedReason, '').trim() || null,
    completedAt: nextProgress?.completedAt || null,
    completedSource:
      nextProgress?.completedSource === 'manual' ? 'manual' :
        nextProgress?.completedSource === 'codes' ? 'codes' : null,
    completedByUserId:
      ensureString(nextProgress?.completedByUserId, '').trim() || null,
    completionBonusApplied: ensureBoolean(
      nextProgress?.completionBonusApplied,
      false,
    ),
    lastSubmittedAt: nextProgress?.lastSubmittedAt || null,
  }
}

const normalizePrequelProgresses = (value, prequels = []) => {
  const normalizedPrequels = normalizePrequelConfigs(prequels)
  const rawItems = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : []

  return rawItems.map((item, index) => {
    const normalized = normalizePrequelProgress(item)
    return {
      ...normalized,
      prequelId:
        normalized.prequelId ||
        normalizedPrequels[index]?.id ||
        (index === 0 ? LEGACY_PREQUEL_ID : `prequel-${index + 1}`),
    }
  })
}

const getGameTeamPrequelProgresses = (gameTeam, prequels = []) => {
  if (
    Array.isArray(gameTeam?.prequelProgresses) &&
    gameTeam.prequelProgresses.length > 0
  ) {
    return normalizePrequelProgresses(gameTeam.prequelProgresses, prequels)
  }
  if (gameTeam?.prequelProgress && typeof gameTeam.prequelProgress === 'object') {
    return normalizePrequelProgresses(gameTeam.prequelProgress, prequels)
  }
  return []
}

const hasPrequelAdjustments = (progress) => {
  const normalized = normalizePrequelProgress(progress)
  return (
    normalized.foundBonusCodes.length > 0 ||
    normalized.foundMainCodes.length > 0 ||
    normalized.foundPenaltyCodes.length > 0 ||
    normalized.wrongPenaltyAppliedCount > 0 ||
    normalized.appliedAdjustments.length > 0 ||
    normalized.appliedStoryEffects.length > 0 ||
    Boolean(normalized.completedAt) ||
    normalized.isClosed
  )
}

const isPrequelProgressExhaustedForConfig = (progress, prequel) => {
  const normalizedProgress = normalizePrequelProgress(progress)
  const normalizedPrequel = normalizePrequelConfig(prequel, {
    includeCodes: false,
  })

  const requiredMainCodes = resolveRequiredPrequelMainCodesCount(normalizedPrequel)
  if (requiredMainCodes > 0) {
    return normalizedProgress.foundMainCodes.length >= requiredMainCodes
  }

  const totalCodes =
    Math.max(0, Number(normalizedPrequel.bonusCodesCount) || 0) +
    Math.max(0, Number(normalizedPrequel.penaltyCodesCount) || 0)
  if (totalCodes <= 0) {
    return false
  }

  const foundCodesCount =
    normalizedProgress.foundBonusCodes.length +
    normalizedProgress.foundPenaltyCodes.length

  return foundCodesCount >= totalCodes
}

const isPrequelProgressClosedForConfig = (progress, prequel) => {
  const normalizedProgress = normalizePrequelProgress(progress)
  if (isPrequelProgressExhaustedForConfig(normalizedProgress, prequel)) {
    return true
  }
  if (!normalizedProgress.isClosed) {
    return Boolean(normalizedProgress.completedAt)
  }

  const normalizedPrequel = normalizePrequelConfig(prequel, {
    includeCodes: false,
  })

  if (
    normalizedPrequel.mode !== PREQUEL_MODE_SINGLE_HIT &&
    normalizedProgress.closedReason === 'single_hit_resolved'
  ) {
    return false
  }

  return true
}

const isPrequelOpenForDate = (prequel, now = new Date()) => {
  const normalizedPrequel = normalizePrequelConfig(prequel, {
    includeCodes: false,
  })
  if (!normalizedPrequel.openAt) {
    return true
  }

  const openAtDate = new Date(normalizedPrequel.openAt)
  const nowDate = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(openAtDate.getTime()) || Number.isNaN(nowDate.getTime())) {
    return true
  }

  return openAtDate.getTime() <= nowDate.getTime()
}

const isPrequelReadyForPlayers = (prequel) => {
  const normalizedPrequel = normalizePrequelConfig(prequel, {
    includeCodes: false,
  })
  if (!normalizedPrequel.enabled || !normalizedPrequel.openAt) {
    return false
  }

  const hasDescription =
    ensureString(normalizedPrequel.description, '').trim() !== '' ||
    ensureString(normalizedPrequel.descriptionRich, '').trim() !== '' ||
    normalizedPrequel.descriptionMedia.length > 0
  const hasAnyCode =
    Math.max(0, Number(normalizedPrequel.mainCodesCount) || 0) > 0 ||
    Math.max(0, Number(normalizedPrequel.bonusCodesCount) || 0) > 0 ||
    Math.max(0, Number(normalizedPrequel.penaltyCodesCount) || 0) > 0

  return hasDescription && hasAnyCode
}

const resolvePrequelStatusForDate = (
  prequel,
  progress,
  now = new Date(),
) => {
  if (isPrequelProgressClosedForConfig(progress, prequel)) {
    return PREQUEL_STATUS_COMPLETED
  }
  if (isPrequelOpenForDate(prequel, now)) {
    return PREQUEL_STATUS_OPEN
  }
  return PREQUEL_STATUS_LOCKED
}

const resolveDefaultPrequelForDate = (prequels, now = new Date()) => {
  const normalizedPrequels = normalizePrequelConfigs(prequels, {
    includeCodes: false,
  })

  return (
    normalizedPrequels.find(
      (prequel) =>
        isPrequelReadyForPlayers(prequel) &&
        isPrequelOpenForDate(prequel, now),
    ) ||
    normalizedPrequels.find((prequel) =>
      isPrequelReadyForPlayers(prequel),
    ) ||
    normalizedPrequels.find((prequel) => prequel.enabled) ||
    normalizedPrequels[0] ||
    null
  )
}

export {
  PREQUEL_EFFECT_TYPES,
  PREQUEL_MODE_MULTI_HIT,
  PREQUEL_MODE_SINGLE_HIT,
  PREQUEL_STATUS_COMPLETED,
  PREQUEL_STATUS_OPEN,
  PREQUEL_STATUS_LOCKED,
  LEGACY_PREQUEL_ID,
  buildDefaultPrequel,
  buildDefaultPrequelProgress,
  hasPrequelAdjustments,
  isPrequelOpenForDate,
  isPrequelReadyForPlayers,
  resolvePrequelStatusForDate,
  resolveDefaultPrequelForDate,
  isPrequelProgressClosedForConfig,
  isPrequelProgressExhaustedForConfig,
  getGamePrequels,
  getGameTeamPrequelProgresses,
  normalizeCompletionBonus,
  normalizePrequelConfigs,
  normalizePrequelProgresses,
  resolveRequiredPrequelMainCodesCount,
  normalizePrequelCodeEntry,
  normalizePrequelConfig,
  normalizePrequelProgress,
  normalizePrequelStoryEffect,
}
