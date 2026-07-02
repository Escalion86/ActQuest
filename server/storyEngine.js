const ACTIVE_ITEM_STATUS = 'active'
const CONSUMED_ITEM_STATUS = 'consumed'
const FINAL_STATUSES = new Set(['completed', 'failed'])

const normalizeId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const normalizeCode = (value) => normalizeId(value).toLowerCase()

const toArray = (value) => (Array.isArray(value) ? value : [])

const uniqueStrings = (values) => {
  const result = []
  const seen = new Set()

  for (const value of toArray(values)) {
    const normalized = normalizeId(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

const toNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const toDate = (value) => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const createEventId = () =>
  `story-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const cloneProgress = (progress = {}) => ({
  status: progress?.status || 'not_started',
  startedAt: toDate(progress?.startedAt),
  finishedAt: toDate(progress?.finishedAt),
  currentEndingId: normalizeId(progress?.currentEndingId) || null,
  unlockedNodeIds: uniqueStrings(progress?.unlockedNodeIds),
  completedNodeIds: uniqueStrings(progress?.completedNodeIds),
  inventory: toArray(progress?.inventory).map((entry) => ({
    itemId: normalizeId(entry?.itemId),
    status:
      entry?.status === CONSUMED_ITEM_STATUS
        ? CONSUMED_ITEM_STATUS
        : ACTIVE_ITEM_STATUS,
    obtainedAt: toDate(entry?.obtainedAt),
    sourceNodeId: normalizeId(entry?.sourceNodeId) || null,
    consumedAt: toDate(entry?.consumedAt),
    consumedAtNodeId: normalizeId(entry?.consumedAtNodeId) || null,
    consumedByActionId: normalizeId(entry?.consumedByActionId) || null,
  })),
  score: toNumber(progress?.score, 0),
  usedClueIds: uniqueStrings(progress?.usedClueIds),
  usedCodeIds: uniqueStrings(progress?.usedCodeIds),
  usedBonusCodeIds: uniqueStrings(progress?.usedBonusCodeIds),
  prequelFlags: uniqueStrings(progress?.prequelFlags),
  history: toArray(progress?.history).map((entry) => ({
    id: normalizeId(entry?.id) || createEventId(),
    type: normalizeId(entry?.type),
    at: toDate(entry?.at),
    nodeId: normalizeId(entry?.nodeId) || null,
    itemId: normalizeId(entry?.itemId) || null,
    actionId: normalizeId(entry?.actionId) || null,
    codeId: normalizeId(entry?.codeId) || null,
    clueId: normalizeId(entry?.clueId) || null,
    endingId: normalizeId(entry?.endingId) || null,
    points: toNumber(entry?.points, 0),
    message: typeof entry?.message === 'string' ? entry.message : '',
    actor: ['team', 'admin', 'system'].includes(entry?.actor)
      ? entry.actor
      : 'system',
  })),
})

const addUnique = (values, nextValues) =>
  uniqueStrings([...toArray(values), ...toArray(nextValues)])

const addHistory = (
  progress,
  {
    type,
    now = new Date(),
    nodeId = null,
    itemId = null,
    actionId = null,
    codeId = null,
    clueId = null,
    endingId = null,
    points = 0,
    message = '',
    actor = 'system',
  },
) => ({
  ...progress,
  history: [
    ...toArray(progress.history),
    {
      id: createEventId(),
      type,
      at: now,
      nodeId: normalizeId(nodeId) || null,
      itemId: normalizeId(itemId) || null,
      actionId: normalizeId(actionId) || null,
      codeId: normalizeId(codeId) || null,
      clueId: normalizeId(clueId) || null,
      endingId: normalizeId(endingId) || null,
      points: toNumber(points, 0),
      message: typeof message === 'string' ? message : '',
      actor: ['team', 'admin', 'system'].includes(actor) ? actor : 'system',
    },
  ],
})

const getStoryItems = (game) => toArray(game?.storyItems)
const getStoryNodes = (game) => toArray(game?.storyNodes)
const getStoryEndings = (game) => toArray(game?.storyEndings)

const getItemById = (game, itemId) =>
  getStoryItems(game).find((item) => normalizeId(item?.id) === normalizeId(itemId))

const getNodeById = (game, nodeId) =>
  getStoryNodes(game).find((node) => normalizeId(node?.id) === normalizeId(nodeId))

const getEndingById = (game, endingId) =>
  getStoryEndings(game).find(
    (ending) => normalizeId(ending?.id) === normalizeId(endingId),
  )

const hasActiveItem = (progress, itemId) => {
  const normalizedItemId = normalizeId(itemId)
  return toArray(progress?.inventory).some(
    (entry) =>
      normalizeId(entry?.itemId) === normalizedItemId &&
      entry?.status === ACTIVE_ITEM_STATUS,
  )
}

const hasCompletedNode = (progress, nodeId) =>
  uniqueStrings(progress?.completedNodeIds).includes(normalizeId(nodeId))

const hasUnlockedNode = (progress, nodeId) =>
  uniqueStrings(progress?.unlockedNodeIds).includes(normalizeId(nodeId))

const areRequirementsMet = (progress, requirements = {}) => {
  const requiredNodeIds = uniqueStrings(
    requirements?.requiredNodeIds ?? requirements?.requiredCompletedNodeIds,
  )
  const requiredItemIds = uniqueStrings(requirements?.requiredItemIds)
  const enabledInputsCount =
    requiredNodeIds.filter((nodeId) => hasCompletedNode(progress, nodeId))
      .length +
    requiredItemIds.filter((itemId) => hasActiveItem(progress, itemId)).length
  const totalInputsCount = requiredNodeIds.length + requiredItemIds.length
  const requiredInputMode = ['any', 'count'].includes(
    requirements?.requiredInputMode,
  )
    ? requirements.requiredInputMode
    : 'all'

  if (totalInputsCount === 0) {
    return true
  }

  if (requiredInputMode === 'any') {
    return enabledInputsCount >= 1
  }

  if (requiredInputMode === 'count') {
    const requiredInputCount = Math.max(
      1,
      Math.trunc(toNumber(requirements?.requiredInputCount, 1)),
    )
    return enabledInputsCount >= Math.min(requiredInputCount, totalInputsCount)
  }

  return (
    requiredNodeIds.every((nodeId) => hasCompletedNode(progress, nodeId)) &&
    requiredItemIds.every((itemId) => hasActiveItem(progress, itemId))
  )
}

const nodeIsAvailable = (node, progress) => {
  const nodeId = normalizeId(node?.id)
  if (!nodeId || FINAL_STATUSES.has(progress?.status)) {
    return false
  }

  if (hasCompletedNode(progress, nodeId)) {
    return false
  }

  if (hasUnlockedNode(progress, nodeId) || node?.visibility?.startVisible) {
    return true
  }

  return areRequirementsMet(progress, {
    requiredNodeIds: node?.visibility?.requiredNodeIds,
    requiredItemIds: node?.visibility?.requiredItemIds,
    requiredInputMode: node?.visibility?.requiredInputMode,
    requiredInputCount: node?.visibility?.requiredInputCount,
  })
}

export const buildInitialStoryProgress = (game, options = {}) => {
  const now = options.now || new Date()
  const startNodeIds = getStoryNodes(game)
    .filter((node) => node?.visibility?.startVisible)
    .map((node) => node?.id)

  let progress = cloneProgress({
    status: 'in_progress',
    startedAt: now,
    unlockedNodeIds: startNodeIds,
    score: options.initialScore || 0,
  })

  progress = addHistory(progress, {
    type: 'story_started',
    now,
    actor: options.actor || 'system',
  })

  return progress
}

export const getAvailableStoryNodes = (game, progress = {}) => {
  const preparedProgress = cloneProgress(progress)
  return getStoryNodes(game).filter((node) => nodeIsAvailable(node, preparedProgress))
}

export const getActiveStoryInventory = (progress = {}) =>
  cloneProgress(progress).inventory.filter(
    (entry) => entry.status === ACTIVE_ITEM_STATUS,
  )

export const grantStoryItem = ({
  game,
  progress,
  itemId,
  actor = 'admin',
  nodeId = null,
  actionId = null,
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const normalizedItemId = normalizeId(itemId)

  if (!normalizedItemId || !getItemById(game, normalizedItemId)) {
    return { progress: prepared, applied: false, reason: 'item_not_found' }
  }

  if (hasActiveItem(prepared, normalizedItemId)) {
    return { progress: prepared, applied: false, reason: 'item_already_active' }
  }

  const nextProgress = addHistory(
    {
      ...prepared,
      inventory: [
        ...prepared.inventory,
        {
          itemId: normalizedItemId,
          status: ACTIVE_ITEM_STATUS,
          obtainedAt: now,
          sourceNodeId: normalizeId(nodeId) || null,
          consumedAt: null,
          consumedAtNodeId: null,
          consumedByActionId: null,
        },
      ],
    },
    {
      type: 'item_granted',
      now,
      itemId: normalizedItemId,
      nodeId,
      actionId,
      actor,
    },
  )

  return { progress: nextProgress, applied: true }
}

export const consumeStoryItem = ({
  game,
  progress,
  itemId,
  actor = 'admin',
  nodeId = null,
  actionId = null,
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const normalizedItemId = normalizeId(itemId)

  if (!normalizedItemId || !getItemById(game, normalizedItemId)) {
    return { progress: prepared, applied: false, reason: 'item_not_found' }
  }

  let consumed = false
  const inventory = prepared.inventory.map((entry) => {
    if (
      consumed ||
      normalizeId(entry?.itemId) !== normalizedItemId ||
      entry?.status !== ACTIVE_ITEM_STATUS
    ) {
      return entry
    }

    consumed = true
    return {
      ...entry,
      status: CONSUMED_ITEM_STATUS,
      consumedAt: now,
      consumedAtNodeId: normalizeId(nodeId) || null,
      consumedByActionId: normalizeId(actionId) || null,
    }
  })

  if (!consumed) {
    return { progress: prepared, applied: false, reason: 'item_not_active' }
  }

  const nextProgress = addHistory(
    { ...prepared, inventory },
    {
      type: 'item_consumed',
      now,
      itemId: normalizedItemId,
      nodeId,
      actionId,
      actor,
    },
  )

  return { progress: nextProgress, applied: true }
}

export const unlockStoryNode = ({
  game,
  progress,
  nodeId,
  actor = 'admin',
  actionId = null,
  codeId = null,
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const normalizedNodeId = normalizeId(nodeId)

  if (!normalizedNodeId || !getNodeById(game, normalizedNodeId)) {
    return { progress: prepared, applied: false, reason: 'node_not_found' }
  }

  if (hasUnlockedNode(prepared, normalizedNodeId)) {
    return { progress: prepared, applied: false, reason: 'node_already_unlocked' }
  }

  const nextProgress = addHistory(
    {
      ...prepared,
      unlockedNodeIds: addUnique(prepared.unlockedNodeIds, [normalizedNodeId]),
    },
    {
      type: 'node_unlocked',
      now,
      nodeId: normalizedNodeId,
      actionId,
      codeId,
      actor,
    },
  )

  return { progress: nextProgress, applied: true }
}

export const changeStoryScore = ({
  progress,
  points,
  reason = 'score_changed',
  actor = 'system',
  nodeId = null,
  actionId = null,
  codeId = null,
  clueId = null,
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const delta = toNumber(points, 0)

  if (delta === 0) {
    return { progress: prepared, applied: false, reason: 'zero_points' }
  }

  const nextProgress = addHistory(
    {
      ...prepared,
      score: prepared.score + delta,
    },
    {
      type: reason,
      now,
      nodeId,
      actionId,
      codeId,
      clueId,
      points: delta,
      actor,
    },
  )

  return { progress: nextProgress, applied: true }
}

export const completeStoryNode = ({
  game,
  progress,
  nodeId,
  actor = 'admin',
  actionId = null,
  codeId = null,
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const normalizedNodeId = normalizeId(nodeId)
  const node = getNodeById(game, normalizedNodeId)

  if (!normalizedNodeId || !node) {
    return { progress: prepared, applied: false, reason: 'node_not_found' }
  }

  if (hasCompletedNode(prepared, normalizedNodeId)) {
    return { progress: prepared, applied: false, reason: 'node_already_completed' }
  }

  let nextProgress = addHistory(
    {
      ...prepared,
      completedNodeIds: addUnique(prepared.completedNodeIds, [normalizedNodeId]),
    },
    {
      type: 'node_completed',
      now,
      nodeId: normalizedNodeId,
      actionId,
      codeId,
      actor,
    },
  )

  const scoreForComplete = toNumber(node?.scoring?.scoreForComplete, 0)
  if (scoreForComplete !== 0) {
    nextProgress = changeStoryScore({
      progress: nextProgress,
      points: scoreForComplete,
      reason: 'node_score',
      actor,
      nodeId: normalizedNodeId,
      actionId,
      codeId,
      now,
    }).progress
  }

  return { progress: nextProgress, applied: true }
}

export const reachStoryEnding = ({
  game,
  progress,
  endingId,
  actor = 'system',
  nodeId = null,
  actionId = null,
  codeId = null,
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const normalizedEndingId = normalizeId(endingId)
  const ending = getEndingById(game, normalizedEndingId)

  if (!normalizedEndingId || !ending) {
    return { progress: prepared, applied: false, reason: 'ending_not_found' }
  }

  if (!areRequirementsMet(prepared, ending?.conditions)) {
    return {
      progress: prepared,
      applied: false,
      reason: 'ending_requirements_not_met',
    }
  }

  const minScore = ending?.conditions?.minScore
  if (minScore !== null && minScore !== undefined && prepared.score < minScore) {
    return { progress: prepared, applied: false, reason: 'ending_score_too_low' }
  }

  const nextStatus = ending?.type === 'failed' ? 'failed' : 'completed'
  const nextProgress = addHistory(
    {
      ...prepared,
      status: nextStatus,
      finishedAt: now,
      currentEndingId: normalizedEndingId,
    },
    {
      type: 'ending_reached',
      now,
      nodeId,
      actionId,
      codeId,
      endingId: normalizedEndingId,
      actor,
    },
  )

  return { progress: nextProgress, applied: true, ending }
}

const applyStoryEffects = ({
  game,
  progress,
  node,
  effect,
  actor,
  actionId = null,
  codeId = null,
  now,
}) => {
  let nextProgress = cloneProgress(progress)
  const nodeId = normalizeId(node?.id)

  const requiredItemIds = uniqueStrings(effect?.requiredItemIds)
  if (!requiredItemIds.every((itemId) => hasActiveItem(nextProgress, itemId))) {
    return {
      progress: nextProgress,
      applied: false,
      reason: 'required_items_missing',
    }
  }

  const grantItemIds = uniqueStrings(effect?.grantsItemIds)
  const consumedItemIdsBeforeGrants = uniqueStrings(effect?.consumesItemIds).filter(
    (itemId) => !grantItemIds.includes(itemId),
  )

  if (
    !consumedItemIdsBeforeGrants.every((itemId) =>
      hasActiveItem(nextProgress, itemId),
    )
  ) {
    return {
      progress: nextProgress,
      applied: false,
      reason: 'consumed_items_missing',
    }
  }

  for (const itemId of grantItemIds) {
    nextProgress = grantStoryItem({
      game,
      progress: nextProgress,
      itemId,
      actor,
      nodeId,
      actionId,
      now,
    }).progress
  }

  const autoConsumedRequiredItemIds = requiredItemIds.filter(
    (itemId) => getItemById(game, itemId)?.consumableOnUse,
  )
  const consumedItemIds = uniqueStrings([
    ...uniqueStrings(effect?.consumesItemIds),
    ...autoConsumedRequiredItemIds,
  ])

  for (const itemId of consumedItemIds) {
    nextProgress = consumeStoryItem({
      game,
      progress: nextProgress,
      itemId,
      actor,
      nodeId,
      actionId,
      now,
    }).progress
  }

  const points =
    toNumber(effect?.scoreBonus, 0) - toNumber(effect?.scorePenalty, 0)
  if (points !== 0) {
    nextProgress = changeStoryScore({
      progress: nextProgress,
      points,
      reason: 'effect_score',
      actor,
      nodeId,
      actionId,
      codeId,
      now,
    }).progress
  }

  for (const unlockedNodeId of uniqueStrings(effect?.unlocksNodeIds)) {
    nextProgress = unlockStoryNode({
      game,
      progress: nextProgress,
      nodeId: unlockedNodeId,
      actor,
      actionId,
      codeId,
      now,
    }).progress
  }

  if (effect?.completesNode) {
    nextProgress = completeStoryNode({
      game,
      progress: nextProgress,
      nodeId,
      actor,
      actionId,
      codeId,
      now,
    }).progress
  }

  if (effect?.endingId) {
    nextProgress = reachStoryEnding({
      game,
      progress: nextProgress,
      endingId: effect.endingId,
      actor,
      nodeId,
      actionId,
      codeId,
      now,
    }).progress
  }

  return { progress: nextProgress, applied: true }
}

export const applyStoryAction = ({
  game,
  progress,
  nodeId,
  actionId,
  actor = 'team',
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const node = getNodeById(game, nodeId)
  const normalizedActionId = normalizeId(actionId)

  if (!node || !nodeIsAvailable(node, prepared)) {
    return { progress: prepared, applied: false, reason: 'node_not_available' }
  }

  const action = toArray(node?.actions).find(
    (item) => normalizeId(item?.id) === normalizedActionId,
  )

  if (!action) {
    return { progress: prepared, applied: false, reason: 'action_not_found' }
  }

  return applyStoryEffects({
    game,
    progress: prepared,
    node,
    effect: action,
    actor,
    actionId: normalizedActionId,
    now,
  })
}

export const applyStoryCode = ({
  game,
  progress,
  nodeId,
  code,
  actor = 'team',
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const node = getNodeById(game, nodeId)
  const enteredCode = normalizeCode(code)

  if (!node || !nodeIsAvailable(node, prepared)) {
    return { progress: prepared, applied: false, reason: 'node_not_available' }
  }

  const storyCode = toArray(node?.codes).find(
    (item) => normalizeCode(item?.code) === enteredCode,
  )

  if (!storyCode) {
    const nextProgress = addHistory(prepared, {
      type: 'wrong_code',
      now,
      nodeId,
      message: normalizeId(code),
      actor,
    })
    return { progress: nextProgress, applied: false, reason: 'code_not_found' }
  }

  const codeId = normalizeId(storyCode?.id)
  if (
    storyCode?.type === 'bonus' &&
    uniqueStrings(prepared.usedBonusCodeIds).includes(codeId)
  ) {
    return { progress: prepared, applied: false, reason: 'bonus_code_used' }
  }

  let nextProgress = {
    ...prepared,
    usedCodeIds: addUnique(prepared.usedCodeIds, [codeId]),
    usedBonusCodeIds:
      storyCode?.type === 'bonus'
        ? addUnique(prepared.usedBonusCodeIds, [codeId])
        : prepared.usedBonusCodeIds,
  }

  nextProgress = addHistory(nextProgress, {
    type: 'code_accepted',
    now,
    nodeId,
    codeId,
    actor,
  })

  return applyStoryEffects({
    game,
    progress: nextProgress,
    node,
    effect: storyCode,
    actor,
    codeId,
    now,
  })
}

export const useStoryClue = ({
  game,
  progress,
  nodeId,
  clueId,
  actor = 'team',
  now = new Date(),
}) => {
  const prepared = cloneProgress(progress)
  const node = getNodeById(game, nodeId)
  const normalizedClueId = normalizeId(clueId)

  if (!node || !nodeIsAvailable(node, prepared)) {
    return { progress: prepared, applied: false, reason: 'node_not_available' }
  }

  const clue = toArray(node?.clues).find(
    (item) => normalizeId(item?.id) === normalizedClueId,
  )

  if (!clue) {
    return { progress: prepared, applied: false, reason: 'clue_not_found' }
  }

  if (uniqueStrings(prepared.usedClueIds).includes(normalizedClueId)) {
    return { progress: prepared, applied: false, reason: 'clue_already_used' }
  }

  let nextProgress = {
    ...prepared,
    usedClueIds: addUnique(prepared.usedClueIds, [normalizedClueId]),
  }

  const penalty = toNumber(clue?.scorePenalty, 0)
  if (penalty !== 0) {
    nextProgress = changeStoryScore({
      progress: nextProgress,
      points: -Math.abs(penalty),
      reason: 'clue_penalty',
      actor,
      nodeId,
      clueId: normalizedClueId,
      now,
    }).progress
  }

  nextProgress = addHistory(nextProgress, {
    type: 'clue_used',
    now,
    nodeId,
    clueId: normalizedClueId,
    actor,
  })

  return { progress: nextProgress, applied: true, clue }
}
