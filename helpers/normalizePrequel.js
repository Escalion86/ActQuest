const PREQUEL_MODE_SINGLE_HIT = 'single_hit'
const PREQUEL_MODE_MULTI_HIT = 'multi_hit'

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

const buildDefaultPrequel = () => ({
  enabled: false,
  openAt: null,
  description: '',
  descriptionRich: '',
  descriptionMedia: [],
  mode: PREQUEL_MODE_MULTI_HIT,
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
  const effectiveBonusCodesCount =
    normalizedBonusCodesCount > 0
      ? normalizedBonusCodesCount
      : ensureNumber(nextPrequel?.bonusCodesCount, 0)
  const effectivePenaltyCodesCount =
    normalizedPenaltyCodesCount > 0
      ? normalizedPenaltyCodesCount
      : ensureNumber(nextPrequel?.penaltyCodesCount, 0)

  return {
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

const buildDefaultPrequelProgress = () => ({
  foundBonusCodes: [],
  foundPenaltyCodes: [],
  wrongCodes: [],
  attempts: [],
  wrongPenaltyAppliedCount: 0,
  appliedAdjustments: [],
  appliedStoryEffects: [],
  isClosed: false,
  closedReason: null,
  lastSubmittedAt: null,
})

const normalizePrequelProgress = (progress) => {
  const nextProgress = progress && typeof progress === 'object' ? progress : {}

  return {
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
        category:
          attempt?.category === 'bonus' || attempt?.category === 'penalty'
            ? attempt.category
            : 'wrong',
        matchedCode: ensureString(attempt?.matchedCode, ''),
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
        item?.source === 'wrong_attempts_limit'
          ? 'wrong_attempts_limit'
          : item?.source === 'penalty_code'
            ? 'penalty_code'
            : 'bonus_code',
      code: ensureString(item?.code, ''),
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
        item?.source === 'wrong_attempts_limit'
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
    lastSubmittedAt: nextProgress?.lastSubmittedAt || null,
  }
}

const hasPrequelAdjustments = (progress) => {
  const normalized = normalizePrequelProgress(progress)
  return (
    normalized.foundBonusCodes.length > 0 ||
    normalized.foundPenaltyCodes.length > 0 ||
    normalized.wrongPenaltyAppliedCount > 0 ||
    normalized.appliedAdjustments.length > 0 ||
    normalized.appliedStoryEffects.length > 0
  )
}

const isPrequelProgressExhaustedForConfig = (progress, prequel) => {
  const normalizedProgress = normalizePrequelProgress(progress)
  const normalizedPrequel = normalizePrequelConfig(prequel, {
    includeCodes: false,
  })

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
    return false
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
  const hasBonusCode = Math.max(0, Number(normalizedPrequel.bonusCodesCount) || 0) > 0

  return hasDescription && hasBonusCode
}

export {
  PREQUEL_EFFECT_TYPES,
  PREQUEL_MODE_MULTI_HIT,
  PREQUEL_MODE_SINGLE_HIT,
  buildDefaultPrequel,
  buildDefaultPrequelProgress,
  hasPrequelAdjustments,
  isPrequelOpenForDate,
  isPrequelReadyForPlayers,
  isPrequelProgressClosedForConfig,
  isPrequelProgressExhaustedForConfig,
  normalizePrequelCodeEntry,
  normalizePrequelConfig,
  normalizePrequelProgress,
  normalizePrequelStoryEffect,
}
