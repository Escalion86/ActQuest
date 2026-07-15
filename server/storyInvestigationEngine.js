import {
  buildInitialStoryProgress,
  changeStoryScore,
  consumeStoryItem,
  grantStoryItem,
  reachStoryEnding,
  unlockStoryNode,
} from './storyEngine.js'

const FINAL_STATUSES = new Set(['completed', 'failed'])
const VALID_ACTORS = new Set(['team', 'admin', 'system'])

const toArray = (value) => (Array.isArray(value) ? value : [])
const normalizeId = (value) =>
  value === null || value === undefined ? '' : String(value).trim()
const toNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}
const toOptionalNumber = (value) =>
  value === null || value === undefined || value === ''
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null
const uniqueIds = (values) => {
  const result = []
  const seen = new Set()
  toArray(values).forEach((value) => {
    const id = normalizeId(value)
    if (id && !seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  })
  return result
}
const cloneValue = (value) => {
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) return value.map(cloneValue)
  if (value && typeof value.toObject === 'function') {
    return cloneValue(value.toObject())
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '_id')
        .map(([key, entry]) => [key, cloneValue(entry)]),
    )
  }
  return value
}
const createEventId = (prefix, now) =>
  `${prefix}-${new Date(now).getTime()}-${Math.random().toString(36).slice(2, 10)}`

export const isInvestigationStory = (game) =>
  game?.type === 'story' && game?.storyConfig?.experienceMode === 'investigation'

const getConfig = (game) => game?.storyConfig?.investigation || {}
const getDeadline = (game) => {
  const value = toNumber(getConfig(game)?.deadlineMinutes, Number.NaN)
  return Number.isFinite(value) && value >= 0 ? value : null
}
const getProgressElapsed = (progress) =>
  Math.max(0, toNumber(progress?.elapsedMinutes, 0))
const isActive = (progress) =>
  !FINAL_STATUSES.has(progress?.status) && !progress?.currentEndingId
const hasId = (values, id) => uniqueIds(values).includes(normalizeId(id))
const findById = (values, id) =>
  toArray(values).find((item) => normalizeId(item?.id) === normalizeId(id))

const addHistory = (progress, event, now) => ({
  ...progress,
  history: [
    ...toArray(progress?.history),
    {
      id: createEventId('investigation', now),
      type: normalizeId(event?.type),
      at: now,
      actor: VALID_ACTORS.has(event?.actor) ? event.actor : 'system',
      nodeId: normalizeId(event?.nodeId) || null,
      itemId: normalizeId(event?.itemId) || null,
      actionId: normalizeId(event?.actionId) || null,
      codeId: null,
      clueId: null,
      endingId: normalizeId(event?.endingId) || null,
      interactionId: normalizeId(event?.interactionId) || null,
      characterId: normalizeId(event?.characterId) || null,
      topicId: normalizeId(event?.topicId) || null,
      evidenceId: normalizeId(event?.evidenceId) || null,
      fromNodeId: normalizeId(event?.fromNodeId) || null,
      toNodeId: normalizeId(event?.toNodeId) || null,
      minutes: toNumber(event?.minutes, 0),
      elapsedMinutes: getProgressElapsed(progress),
      points: toNumber(event?.points, 0),
      message: typeof event?.message === 'string' ? event.message : '',
    },
  ],
})

const formatClockMinutes = (minutes) => {
  const normalized = ((Math.trunc(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

export const getInvestigationClock = (game, progress = {}) => {
  const config = getConfig(game)
  const startClockMinutes = Math.max(0, toNumber(config?.startClockMinutes, 0))
  const elapsedMinutes = getProgressElapsed(progress)
  const deadlineMinutes = getDeadline(game)
  const currentClockMinutes = startClockMinutes + elapsedMinutes
  const remainingMinutes =
    deadlineMinutes === null
      ? null
      : Math.max(0, deadlineMinutes - elapsedMinutes)

  return {
    startClockMinutes,
    elapsedMinutes,
    deadlineMinutes,
    currentClockMinutes,
    remainingMinutes,
    formattedCurrentTime: formatClockMinutes(currentClockMinutes),
    formattedDeadline:
      deadlineMinutes === null
        ? null
        : formatClockMinutes(startClockMinutes + deadlineMinutes),
  }
}

export const buildInitialInvestigationProgress = (game, options = {}) => {
  if (!isInvestigationStory(game)) return null

  const now = options.now || new Date()
  const config = getConfig(game)
  const startNodeId = normalizeId(config?.startNodeId)
  const nodes = toArray(game?.storyNodes)
  const validStartNode = findById(nodes, startNodeId)
  const fallbackNode = nodes.find((node) => node?.visibility?.startVisible)
  const currentNodeId = normalizeId(validStartNode?.id ?? fallbackNode?.id) || null
  let progress = buildInitialStoryProgress(game, options)

  progress = {
    ...progress,
    currentNodeId,
    elapsedMinutes: 0,
    unlockedCharacterIds: uniqueIds(
      toArray(game?.storyCharacters)
        .filter((character) => character?.startVisible)
        .map((character) => character?.id),
    ),
    unlockedTopicIds: uniqueIds(
      toArray(game?.storyTopics)
        .filter((topic) => topic?.startVisible)
        .map((topic) => topic?.id),
    ),
    usedInteractionIds: [],
    discoveredEvidenceIds: [],
    flags: [],
    journal: [],
    accusation: {
      submittedAt: null,
      submittedAtMinute: null,
      culpritId: null,
      motiveId: null,
      evidenceIds: [],
      outcomeId: null,
    },
  }
  return addHistory(
    progress,
    {
      type: 'investigation_started',
      actor: options.actor || 'system',
      nodeId: currentNodeId,
    },
    now,
  )
}

export const upgradeInvestigationProgress = (game, progress, options = {}) => {
  const source = cloneValue(progress)
  if (!isInvestigationStory(game) || !source) {
    return { progress: source, upgraded: false }
  }

  const initial = buildInitialInvestigationProgress(game, options)
  const nodes = toArray(game?.storyNodes)
  const currentNodeId = normalizeId(source?.currentNodeId)
  const hasValidCurrentNode = Boolean(findById(nodes, currentNodeId))
  const initialCharacterIds = uniqueIds(initial?.unlockedCharacterIds)
  const sourceCharacterIds = uniqueIds(source?.unlockedCharacterIds)
  const unlockedCharacterIds = uniqueIds([
    ...initialCharacterIds,
    ...sourceCharacterIds,
  ])
  const initialTopicIds = uniqueIds(initial?.unlockedTopicIds)
  const sourceTopicIds = uniqueIds(source?.unlockedTopicIds)
  const unlockedTopicIds = uniqueIds([
    ...initialTopicIds,
    ...sourceTopicIds,
  ])
  const upgraded =
    !hasValidCurrentNode ||
    initialCharacterIds.some((id) => !sourceCharacterIds.includes(id)) ||
    initialTopicIds.some((id) => !sourceTopicIds.includes(id))

  if (!upgraded) {
    return { progress: source, upgraded: false }
  }

  return {
    upgraded: true,
    progress: {
      ...initial,
      ...source,
      currentNodeId: hasValidCurrentNode
        ? currentNodeId
        : initial.currentNodeId,
      elapsedMinutes: getProgressElapsed(source),
      unlockedNodeIds: uniqueIds([
        ...toArray(initial?.unlockedNodeIds),
        ...toArray(source?.unlockedNodeIds),
      ]),
      unlockedCharacterIds,
      unlockedTopicIds,
      usedInteractionIds: uniqueIds(source?.usedInteractionIds),
      discoveredEvidenceIds: uniqueIds(source?.discoveredEvidenceIds),
      flags: uniqueIds(source?.flags),
      journal: toArray(source?.journal),
      accusation: {
        ...(initial?.accusation || {}),
        ...(source?.accusation || {}),
      },
      history: toArray(source?.history),
    },
  }
}

export const getUnlockedInvestigationLocations = (game, progress = {}) => {
  const unlockedIds = new Set(uniqueIds(progress?.unlockedNodeIds))
  return toArray(game?.storyNodes).filter(
    (node) => unlockedIds.has(normalizeId(node?.id)) || node?.visibility?.startVisible,
  )
}

const hasActiveItem = (progress, itemId) =>
  toArray(progress?.inventory).some(
    (entry) =>
      normalizeId(entry?.itemId) === normalizeId(itemId) &&
      entry?.status === 'active',
  )

const interactionConditionsMet = (game, progress, interaction) => {
  const conditions = interaction?.conditions || {}
  if (
    normalizeId(interaction?.locationId) !== normalizeId(progress?.currentNodeId)
  ) {
    return false
  }
  if (
    interaction?.characterId &&
    !hasId(progress?.unlockedCharacterIds, interaction.characterId)
  ) {
    return false
  }
  if (
    interaction?.topicId &&
    !hasId(progress?.unlockedTopicIds, interaction.topicId)
  ) {
    return false
  }
  if (
    !uniqueIds(conditions?.requiredItemIds).every((id) =>
      hasActiveItem(progress, id),
    ) ||
    !uniqueIds(conditions?.requiredEvidenceIds).every((id) =>
      hasId(progress?.discoveredEvidenceIds, id),
    ) ||
    !uniqueIds(conditions?.requiredTopicIds).every((id) =>
      hasId(progress?.unlockedTopicIds, id),
    ) ||
    !uniqueIds(conditions?.requiredCharacterIds).every((id) =>
      hasId(progress?.unlockedCharacterIds, id),
    ) ||
    !uniqueIds(conditions?.requiredInteractionIds).every((id) =>
      hasId(progress?.usedInteractionIds, id),
    ) ||
    !uniqueIds(conditions?.requiredFlagIds).every((id) =>
      hasId(progress?.flags, id),
    )
  ) {
    return false
  }

  const elapsed = getProgressElapsed(progress)
  const minElapsed = toOptionalNumber(conditions?.minElapsedMinutes)
  const maxElapsed = toOptionalNumber(conditions?.maxElapsedMinutes)
  return !(
    (minElapsed !== null && elapsed < minElapsed) ||
    (maxElapsed !== null && elapsed > maxElapsed)
  )
}

export const getAvailableInvestigationInteractions = (game, progress = {}) =>
  isActive(progress)
    ? toArray(game?.storyInteractions).filter(
        (interaction) =>
          interactionConditionsMet(game, progress, interaction) &&
          !hasId(progress?.usedInteractionIds, interaction?.id),
      )
    : []

const reachTimeout = (game, progress, actor, now) => {
  const deadline = getDeadline(game)
  const timeoutEndingId = normalizeId(game?.storyAccusation?.timeoutEndingId)
  const prepared = {
    ...cloneValue(progress),
    elapsedMinutes:
      deadline === null ? getProgressElapsed(progress) : Math.max(deadline, 0),
  }
  if (!timeoutEndingId || !isActive(prepared)) return prepared
  return reachStoryEnding({
    game,
    progress: prepared,
    endingId: timeoutEndingId,
    actor: actor || 'system',
    now,
  }).progress
}

export const applyInvestigationDeadline = ({
  game,
  progress,
  actor = 'system',
  now = new Date(),
}) => {
  const prepared = cloneValue(progress)
  const deadline = getDeadline(game)
  if (
    !isInvestigationStory(game) ||
    !isActive(prepared) ||
    deadline === null ||
    getProgressElapsed(prepared) < deadline ||
    getConfig(game)?.autoFailOnDeadline === false
  ) {
    return { progress: prepared, applied: false, reason: 'deadline_not_reached' }
  }
  return {
    progress: reachTimeout(game, prepared, actor, now),
    applied: true,
    reason: 'deadline_reached',
  }
}

const prepareTimeCost = (value, fallback) =>
  Math.max(0, toNumber(value, Math.max(0, toNumber(fallback, 0))))

const checkTimeBudget = ({ game, progress, cost, actor, now }) => {
  const deadline = getDeadline(game)
  if (deadline === null || getProgressElapsed(progress) + cost <= deadline) {
    return null
  }
  return {
    progress: reachTimeout(game, progress, actor, now),
    applied: false,
    reason: 'deadline_exceeded',
  }
}

export const travelInvestigation = ({
  game,
  progress,
  targetNodeId,
  actor = 'team',
  now = new Date(),
}) => {
  const prepared = cloneValue(progress)
  if (!isInvestigationStory(game)) {
    return { progress: prepared, applied: false, reason: 'not_investigation' }
  }
  if (!isActive(prepared)) {
    return { progress: prepared, applied: false, reason: 'story_finished' }
  }
  const targetId = normalizeId(targetNodeId)
  if (targetId === normalizeId(prepared?.currentNodeId)) {
    return { progress: prepared, applied: false, reason: 'already_at_location' }
  }
  const target = findById(
    getUnlockedInvestigationLocations(game, prepared),
    targetId,
  )
  if (!target) {
    return { progress: prepared, applied: false, reason: 'location_not_available' }
  }
  const cost = prepareTimeCost(
    target?.travelTimeMinutes,
    getConfig(game)?.defaultTravelTimeMinutes,
  )
  const deadlineResult = checkTimeBudget({
    game,
    progress: prepared,
    cost,
    actor,
    now,
  })
  if (deadlineResult) return deadlineResult

  let next = {
    ...prepared,
    currentNodeId: targetId,
    elapsedMinutes: getProgressElapsed(prepared) + cost,
  }
  next = addHistory(
    next,
    {
      type: 'investigation_travelled',
      actor,
      fromNodeId: prepared?.currentNodeId,
      toNodeId: targetId,
      nodeId: targetId,
      minutes: cost,
    },
    now,
  )
  const deadline = applyInvestigationDeadline({ game, progress: next, actor, now })
  return { progress: deadline.applied ? deadline.progress : next, applied: true }
}

const applyExistingEffects = ({ game, progress, interaction, actor, now }) => {
  const original = cloneValue(progress)
  let next = cloneValue(progress)
  const effects = interaction?.effects || {}
  const interactionId = normalizeId(interaction?.id)
  const locationId = normalizeId(interaction?.locationId)

  for (const itemId of uniqueIds(effects?.grantsItemIds)) {
    const result = grantStoryItem({
      game,
      progress: next,
      itemId,
      actor,
      nodeId: locationId,
      actionId: interactionId,
      now,
    })
    if (!result.applied && result.reason !== 'item_already_active') {
      return { progress: original, applied: false, reason: result.reason }
    }
    next = result.progress
  }
  for (const itemId of uniqueIds(effects?.consumesItemIds)) {
    const result = consumeStoryItem({
      game,
      progress: next,
      itemId,
      actor,
      nodeId: locationId,
      actionId: interactionId,
      now,
    })
    if (!result.applied) {
      return { progress: original, applied: false, reason: result.reason }
    }
    next = result.progress
  }
  for (const nodeId of uniqueIds(effects?.unlocksNodeIds)) {
    const result = unlockStoryNode({
      game,
      progress: next,
      nodeId,
      actor,
      actionId: interactionId,
      now,
    })
    if (!result.applied && result.reason !== 'node_already_unlocked') {
      return { progress: original, applied: false, reason: result.reason }
    }
    next = result.progress
  }
  const points =
    toNumber(effects?.scoreBonus, 0) - toNumber(effects?.scorePenalty, 0)
  if (points !== 0) {
    next = changeStoryScore({
      progress: next,
      points,
      reason: 'investigation_interaction_score',
      actor,
      nodeId: locationId,
      actionId: interactionId,
      now,
    }).progress
  }
  return { progress: next, applied: true }
}

const appendInvestigationEffects = ({ game, progress, interaction, actor, now }) => {
  const original = cloneValue(progress)
  const effects = interaction?.effects || {}
  const validateIds = (values, source) =>
    uniqueIds(values).every((id) => Boolean(findById(source, id)))
  if (
    !validateIds(effects?.grantsEvidenceIds, game?.storyEvidence) ||
    !validateIds(effects?.unlocksCharacterIds, game?.storyCharacters) ||
    !validateIds(effects?.unlocksTopicIds, game?.storyTopics)
  ) {
    return { progress: original, applied: false, reason: 'effect_reference_not_found' }
  }

  const result = applyExistingEffects({
    game,
    progress,
    interaction,
    actor,
    now,
  })
  if (!result.applied) return result
  const effectsProgress = result.progress
  return {
    progress: {
      ...effectsProgress,
      discoveredEvidenceIds: uniqueIds([
        ...toArray(effectsProgress?.discoveredEvidenceIds),
        ...toArray(effects?.grantsEvidenceIds),
      ]),
      unlockedCharacterIds: uniqueIds([
        ...toArray(effectsProgress?.unlockedCharacterIds),
        ...toArray(effects?.unlocksCharacterIds),
      ]),
      unlockedTopicIds: uniqueIds([
        ...toArray(effectsProgress?.unlockedTopicIds),
        ...toArray(effects?.unlocksTopicIds),
      ]),
      flags: uniqueIds([
        ...toArray(effectsProgress?.flags),
        ...toArray(effects?.setsFlagIds),
      ]),
    },
    applied: true,
  }
}

const accusationAvailabilityMet = (game, progress) => {
  const availability = game?.storyAccusation?.availability || {}
  const evidenceById = new Map(
    toArray(game?.storyEvidence).map((item) => [normalizeId(item?.id), item]),
  )
  const keyEvidenceCount = uniqueIds(progress?.discoveredEvidenceIds).filter(
    (id) => evidenceById.get(id)?.isKey,
  ).length
  return (
    keyEvidenceCount >= Math.max(0, toNumber(availability?.minKeyEvidence, 0)) &&
    uniqueIds(availability?.requiredEvidenceIds).every((id) =>
      hasId(progress?.discoveredEvidenceIds, id),
    ) &&
    uniqueIds(availability?.requiredInteractionIds).every((id) =>
      hasId(progress?.usedInteractionIds, id),
    )
  )
}

export const unlockInvestigationAccusationIfAvailable = ({
  game,
  progress,
  actor = 'system',
  now = new Date(),
}) => {
  const prepared = cloneValue(progress)
  const topicId = normalizeId(game?.storyAccusation?.unlockTopicId)
  if (
    game?.storyAccusation?.enabled !== true ||
    !topicId ||
    hasId(prepared?.unlockedTopicIds, topicId) ||
    !accusationAvailabilityMet(game, prepared)
  ) {
    return { progress: prepared, applied: false, reason: 'accusation_not_available' }
  }
  const next = addHistory(
    {
      ...prepared,
      unlockedTopicIds: uniqueIds([
        ...toArray(prepared?.unlockedTopicIds),
        topicId,
      ]),
    },
    { type: 'accusation_unlocked', actor, topicId },
    now,
  )
  return { progress: next, applied: true }
}

export const applyInvestigationInteraction = ({
  game,
  progress,
  interactionId,
  actor = 'team',
  now = new Date(),
}) => {
  const prepared = cloneValue(progress)
  if (!isInvestigationStory(game)) {
    return { progress: prepared, applied: false, reason: 'not_investigation' }
  }
  if (!isActive(prepared)) {
    return { progress: prepared, applied: false, reason: 'story_finished' }
  }
  const interaction = findById(game?.storyInteractions, interactionId)
  if (!interaction) {
    return { progress: prepared, applied: false, reason: 'interaction_not_found' }
  }
  const normalizedInteractionId = normalizeId(interaction?.id)
  if (hasId(prepared?.usedInteractionIds, normalizedInteractionId)) {
    return {
      progress: prepared,
      applied: false,
      reason: 'interaction_already_used',
      replayAvailable: getConfig(game)?.allowFreeReplay !== false,
    }
  }
  if (!interactionConditionsMet(game, prepared, interaction)) {
    return { progress: prepared, applied: false, reason: 'interaction_not_available' }
  }
  const cost = prepareTimeCost(
    interaction?.timeCostMinutes,
    getConfig(game)?.defaultInteractionTimeMinutes,
  )
  const deadlineResult = checkTimeBudget({
    game,
    progress: prepared,
    cost,
    actor,
    now,
  })
  if (deadlineResult) return deadlineResult

  const effects = appendInvestigationEffects({
    game,
    progress: prepared,
    interaction,
    actor,
    now,
  })
  if (!effects.applied) return effects

  const journalConfig = interaction?.journal || {}
  const entry = {
    id: createEventId('journal', now),
    interactionId: normalizedInteractionId,
    kind: ['testimony', 'evidence', 'observation', 'system'].includes(
      journalConfig?.kind,
    )
      ? journalConfig.kind
      : 'observation',
    title:
      typeof journalConfig?.title === 'string' && journalConfig.title.trim()
        ? journalConfig.title
        : String(interaction?.label || ''),
    summaryRich:
      typeof journalConfig?.summaryRich === 'string' &&
      journalConfig.summaryRich.trim()
        ? journalConfig.summaryRich
        : typeof interaction?.responseRich === 'string'
          ? interaction.responseRich
          : '',
    media: cloneValue(toArray(interaction?.media)),
    characterId: normalizeId(interaction?.characterId) || null,
    topicId: normalizeId(interaction?.topicId) || null,
    locationId: normalizeId(interaction?.locationId) || null,
    evidenceId: normalizeId(toArray(interaction?.effects?.grantsEvidenceIds)[0]) || null,
    discoveredAtMinute: getProgressElapsed(effects.progress) + cost,
    createdAt: now,
  }

  let next = {
    ...effects.progress,
    elapsedMinutes: getProgressElapsed(effects.progress) + cost,
    usedInteractionIds: uniqueIds([
      ...toArray(effects.progress?.usedInteractionIds),
      normalizedInteractionId,
    ]),
    journal: [...toArray(effects.progress?.journal), entry],
  }
  next = addHistory(
    next,
    {
      type: 'investigation_interaction_used',
      actor,
      interactionId: normalizedInteractionId,
      characterId: interaction?.characterId,
      topicId: interaction?.topicId,
      nodeId: interaction?.locationId,
      evidenceId: entry.evidenceId,
      minutes: cost,
    },
    now,
  )
  const unlocked = unlockInvestigationAccusationIfAvailable({
    game,
    progress: next,
    actor: 'system',
    now,
  })
  next = unlocked.applied ? unlocked.progress : next

  if (interaction?.effects?.endingId) {
    const ending = reachStoryEnding({
      game,
      progress: next,
      endingId: interaction.effects.endingId,
      actor,
      actionId: normalizedInteractionId,
      nodeId: interaction?.locationId,
      now,
    })
    if (!ending.applied) {
      return { progress: prepared, applied: false, reason: ending.reason }
    }
    next = ending.progress
  }
  const deadline = applyInvestigationDeadline({ game, progress: next, actor, now })
  next = deadline.applied ? deadline.progress : next

  return {
    progress: next,
    applied: true,
    responseRich:
      typeof interaction?.responseRich === 'string'
        ? interaction.responseRich
        : '',
    media: cloneValue(toArray(interaction?.media)),
    journalEntry: entry,
  }
}

const outcomeMatches = (game, progress, accusation, outcome) => {
  const conditions = outcome?.conditions || {}
  const correctCulprit =
    normalizeId(accusation?.culpritId) ===
    normalizeId(game?.storyAccusation?.correctCulpritId)
  const correctMotive =
    normalizeId(accusation?.motiveId) ===
    normalizeId(game?.storyAccusation?.correctMotiveId)
  if (
    (conditions?.culprit === 'correct' && !correctCulprit) ||
    (conditions?.culprit === 'incorrect' && correctCulprit) ||
    (conditions?.motive === 'correct' && !correctMotive) ||
    (conditions?.motive === 'incorrect' && correctMotive)
  ) {
    return false
  }
  const selectedIds = uniqueIds(accusation?.evidenceIds)
  const selectedEvidence = selectedIds
    .map((id) => findById(game?.storyEvidence, id))
    .filter(Boolean)
  const selectedTags = new Set(
    selectedEvidence.flatMap((evidence) => uniqueIds(evidence?.tags)),
  )
  const keyEvidenceCount = selectedEvidence.filter((item) => item?.isKey).length
  const maxElapsedMinutes = toOptionalNumber(conditions?.maxElapsedMinutes)
  const maxUsedClues = toOptionalNumber(conditions?.maxUsedClues)
  return (
    selectedIds.length >= Math.max(0, toNumber(conditions?.minSelectedEvidence, 0)) &&
    keyEvidenceCount >= Math.max(0, toNumber(conditions?.minKeyEvidence, 0)) &&
    uniqueIds(conditions?.requiredEvidenceIds).every((id) =>
      selectedIds.includes(id),
    ) &&
    uniqueIds(conditions?.requiredEvidenceTags).every((tag) =>
      selectedTags.has(tag),
    ) &&
    (maxElapsedMinutes === null ||
      getProgressElapsed(progress) <= maxElapsedMinutes) &&
    (maxUsedClues === null ||
      uniqueIds(progress?.usedClueIds).length <= maxUsedClues)
  )
}

export const evaluateInvestigationOutcome = ({ game, progress, accusation }) => {
  const outcomes = [...toArray(game?.storyAccusation?.outcomes)].sort(
    (left, right) => toNumber(right?.priority, 0) - toNumber(left?.priority, 0),
  )
  return (
    outcomes.find((outcome) => outcomeMatches(game, progress, accusation, outcome)) ||
    null
  )
}

export const submitInvestigationAccusation = ({
  game,
  progress,
  culpritId,
  motiveId,
  evidenceIds,
  actor = 'team',
  now = new Date(),
}) => {
  const prepared = cloneValue(progress)
  const accusationConfig = game?.storyAccusation || {}
  if (!isInvestigationStory(game)) {
    return { progress: prepared, applied: false, reason: 'not_investigation' }
  }
  if (!isActive(prepared)) {
    return { progress: prepared, applied: false, reason: 'story_finished' }
  }
  if (accusationConfig?.enabled !== true || prepared?.accusation?.submittedAt) {
    return { progress: prepared, applied: false, reason: 'accusation_unavailable' }
  }
  if (
    normalizeId(accusationConfig?.requiredNodeId) &&
    normalizeId(prepared?.currentNodeId) !==
      normalizeId(accusationConfig.requiredNodeId)
  ) {
    return { progress: prepared, applied: false, reason: 'wrong_accusation_location' }
  }
  if (
    normalizeId(accusationConfig?.unlockTopicId) &&
    !hasId(prepared?.unlockedTopicIds, accusationConfig.unlockTopicId)
  ) {
    return { progress: prepared, applied: false, reason: 'accusation_unavailable' }
  }

  const normalizedCulpritId = normalizeId(culpritId)
  const normalizedMotiveId = normalizeId(motiveId)
  if (!hasId(accusationConfig?.culpritCharacterIds, normalizedCulpritId)) {
    return { progress: prepared, applied: false, reason: 'culprit_not_available' }
  }
  if (!findById(accusationConfig?.motives, normalizedMotiveId)) {
    return { progress: prepared, applied: false, reason: 'motive_not_available' }
  }
  const rawEvidenceIds = toArray(evidenceIds).map(normalizeId).filter(Boolean)
  const selectedEvidenceIds = uniqueIds(rawEvidenceIds)
  if (rawEvidenceIds.length !== selectedEvidenceIds.length) {
    return { progress: prepared, applied: false, reason: 'duplicate_evidence' }
  }
  if (
    !selectedEvidenceIds.every((id) =>
      hasId(prepared?.discoveredEvidenceIds, id),
    )
  ) {
    return { progress: prepared, applied: false, reason: 'evidence_not_discovered' }
  }
  const minEvidence = Math.max(
    0,
    toNumber(accusationConfig?.minSelectableEvidence, 0),
  )
  const maxEvidence = Math.max(
    minEvidence,
    toNumber(accusationConfig?.maxSelectableEvidence, 5),
  )
  if (selectedEvidenceIds.length < minEvidence || selectedEvidenceIds.length > maxEvidence) {
    return { progress: prepared, applied: false, reason: 'invalid_evidence_count' }
  }

  const cost = prepareTimeCost(
    getConfig(game)?.accusationTimeMinutes,
    getConfig(game)?.defaultInteractionTimeMinutes,
  )
  const deadlineResult = checkTimeBudget({
    game,
    progress: prepared,
    cost,
    actor,
    now,
  })
  if (deadlineResult) return deadlineResult

  const elapsedMinutes = getProgressElapsed(prepared) + cost
  const accusation = {
    submittedAt: now,
    submittedAtMinute: elapsedMinutes,
    culpritId: normalizedCulpritId,
    motiveId: normalizedMotiveId,
    evidenceIds: selectedEvidenceIds,
    outcomeId: null,
  }
  const candidate = { ...prepared, elapsedMinutes, accusation }
  const outcome = evaluateInvestigationOutcome({
    game,
    progress: candidate,
    accusation,
  })
  const endingId = normalizeId(
    outcome?.endingId || accusationConfig?.fallbackEndingId,
  )
  if (!endingId) {
    return { progress: prepared, applied: false, reason: 'accusation_ending_not_found' }
  }
  accusation.outcomeId = normalizeId(outcome?.id) || null
  let next = addHistory(
    { ...candidate, accusation },
    {
      type: 'investigation_accusation_submitted',
      actor,
      nodeId: prepared?.currentNodeId,
      minutes: cost,
      message: normalizeId(outcome?.id),
    },
    now,
  )
  const ending = reachStoryEnding({
    game,
    progress: next,
    endingId,
    actor,
    nodeId: prepared?.currentNodeId,
    now,
  })
  if (!ending.applied) {
    return { progress: prepared, applied: false, reason: ending.reason }
  }
  next = ending.progress
  return {
    progress: next,
    applied: true,
    outcomeId: accusation.outcomeId,
    endingId,
  }
}

export const setInvestigationLocation = ({
  game,
  progress,
  nodeId,
  actor = 'admin',
  now = new Date(),
}) => {
  const prepared = cloneValue(progress)
  const target = findById(game?.storyNodes, nodeId)
  if (!isInvestigationStory(game) || !target) {
    return { progress: prepared, applied: false, reason: 'location_not_found' }
  }
  if (!isActive(prepared)) {
    return { progress: prepared, applied: false, reason: 'story_finished' }
  }
  const targetId = normalizeId(target?.id)
  if (targetId === normalizeId(prepared?.currentNodeId)) {
    return { progress: prepared, applied: false, reason: 'already_at_location' }
  }
  const next = addHistory(
    {
      ...prepared,
      currentNodeId: targetId,
      unlockedNodeIds: uniqueIds([
        ...toArray(prepared?.unlockedNodeIds),
        targetId,
      ]),
    },
    {
      type: 'admin_investigation_location_set',
      actor,
      fromNodeId: prepared?.currentNodeId,
      toNodeId: targetId,
      nodeId: targetId,
    },
    now,
  )
  return { progress: next, applied: true }
}

export const adjustInvestigationTime = ({
  game,
  progress,
  minutes,
  actor = 'admin',
  now = new Date(),
}) => {
  const prepared = cloneValue(progress)
  const delta = Math.trunc(toNumber(minutes, Number.NaN))
  if (!isInvestigationStory(game) || !Number.isFinite(delta) || delta === 0) {
    return { progress: prepared, applied: false, reason: 'invalid_minutes' }
  }
  if (!isActive(prepared)) {
    return { progress: prepared, applied: false, reason: 'story_finished' }
  }
  let next = {
    ...prepared,
    elapsedMinutes: Math.max(0, getProgressElapsed(prepared) + delta),
  }
  next = addHistory(
    next,
    {
      type: 'admin_investigation_time_adjusted',
      actor,
      minutes: delta,
    },
    now,
  )
  const deadline = applyInvestigationDeadline({ game, progress: next, actor, now })
  return { progress: deadline.applied ? deadline.progress : next, applied: true }
}

const unlockInvestigationKnowledge = ({
  game,
  progress,
  id,
  source,
  progressField,
  historyType,
  historyField,
  actor,
  now,
}) => {
  const prepared = cloneValue(progress)
  const normalizedId = normalizeId(id)
  if (!isInvestigationStory(game) || !findById(source, normalizedId)) {
    return { progress: prepared, applied: false, reason: 'knowledge_not_found' }
  }
  if (!isActive(prepared)) {
    return { progress: prepared, applied: false, reason: 'story_finished' }
  }
  if (hasId(prepared?.[progressField], normalizedId)) {
    return { progress: prepared, applied: false, reason: 'knowledge_already_unlocked' }
  }
  const next = addHistory(
    {
      ...prepared,
      [progressField]: uniqueIds([
        ...toArray(prepared?.[progressField]),
        normalizedId,
      ]),
    },
    { type: historyType, actor, [historyField]: normalizedId },
    now,
  )
  return { progress: next, applied: true }
}

export const unlockInvestigationCharacter = ({
  game,
  progress,
  characterId,
  actor = 'admin',
  now = new Date(),
}) =>
  unlockInvestigationKnowledge({
    game,
    progress,
    id: characterId,
    source: game?.storyCharacters,
    progressField: 'unlockedCharacterIds',
    historyType: 'admin_investigation_character_unlocked',
    historyField: 'characterId',
    actor,
    now,
  })

export const unlockInvestigationTopic = ({
  game,
  progress,
  topicId,
  actor = 'admin',
  now = new Date(),
}) =>
  unlockInvestigationKnowledge({
    game,
    progress,
    id: topicId,
    source: game?.storyTopics,
    progressField: 'unlockedTopicIds',
    historyType: 'admin_investigation_topic_unlocked',
    historyField: 'topicId',
    actor,
    now,
  })

export const grantInvestigationEvidence = ({
  game,
  progress,
  evidenceId,
  actor = 'admin',
  now = new Date(),
}) =>
  unlockInvestigationKnowledge({
    game,
    progress,
    id: evidenceId,
    source: game?.storyEvidence,
    progressField: 'discoveredEvidenceIds',
    historyType: 'admin_investigation_evidence_granted',
    historyField: 'evidenceId',
    actor,
    now,
  })
