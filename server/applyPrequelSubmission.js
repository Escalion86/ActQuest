import {
  PREQUEL_MODE_SINGLE_HIT,
  buildDefaultPrequelProgress,
  getGamePrequels,
  getGameTeamPrequelProgresses,
  isPrequelProgressClosedForConfig,
  isPrequelProgressExhaustedForConfig,
  normalizePrequelConfig,
  normalizePrequelProgress,
  resolveRequiredPrequelMainCodesCount,
} from '../helpers/normalizePrequel.js'

const normalizeCodeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

const createAttempt = ({
  index,
  code,
  normalizedCode,
  category,
  matchedCode = '',
  source,
  actorUserId,
  now,
}) => ({
  id: `prequel-attempt-${Date.now()}-${index}`,
  code,
  normalizedCode,
  category,
  matchedCode,
  source: source === 'admin' ? 'admin' : 'player',
  actorUserId: actorUserId || null,
  createdAt: now,
})

const createAdjustment = ({
  index,
  type,
  source,
  code = '',
  codeId = '',
  value = 0,
  description = '',
  now,
}) => ({
  id: `prequel-adjustment-${Date.now()}-${index}`,
  type,
  source,
  code,
  codeId,
  value,
  description,
  createdAt: now,
})

const createAppliedStoryEffect = ({
  index,
  effect,
  source,
  code = '',
  now,
}) => ({
  id: `prequel-story-effect-${Date.now()}-${index}`,
  effectId: effect.id || '',
  source,
  code,
  type: effect.type,
  itemId: effect.itemId || '',
  nodeId: effect.nodeId || '',
  flagKey: effect.flagKey || '',
  flagValue: effect.flagValue !== false,
  value: Number(effect.value) || 0,
  label: effect.label || '',
  appliedAt: now,
})

const appendStoryEffects = ({ progress, effects, source, code = '', now }) => {
  ;(Array.isArray(effects) ? effects : []).forEach((effect, index) => {
    progress.appliedStoryEffects.push(
      createAppliedStoryEffect({
        index: progress.appliedStoryEffects.length + index,
        effect,
        source,
        code,
        now,
      }),
    )
  })
}

const completePrequelProgress = ({
  progress,
  prequel,
  source = 'codes',
  actorUserId = null,
  now,
}) => {
  if (progress.completedAt || progress.completionBonusApplied) {
    return progress
  }

  const nextProgress = {
    ...progress,
    appliedAdjustments: [...progress.appliedAdjustments],
    appliedStoryEffects: [...progress.appliedStoryEffects],
    isClosed: true,
    closedReason: source === 'manual' ? 'manual_complete' : 'completed',
    completedAt: now,
    completedSource: source === 'manual' ? 'manual' : 'codes',
    completedByUserId: source === 'manual' ? actorUserId || null : null,
    completionBonusApplied: true,
    lastSubmittedAt: now,
  }

  const completionBonus = prequel?.completionBonus || {}
  const bonusValue = Number(completionBonus?.value) || 0
  if (bonusValue !== 0 || completionBonus?.description) {
    nextProgress.appliedAdjustments.push(
      createAdjustment({
        index: nextProgress.appliedAdjustments.length,
        type: 'bonus',
        source: 'completion_bonus',
        value: bonusValue,
        description:
          completionBonus?.description || 'Бонус за выполнение приквела',
        now,
      }),
    )
  }

  appendStoryEffects({
    progress: nextProgress,
    effects: completionBonus?.storyEffects,
    source: 'completion_bonus',
    now,
  })

  return nextProgress
}

const resolvePrequelAndProgress = ({ game, gameTeam, prequelId, prequel }) => {
  const prequels = getGamePrequels(game)
  const fallbackPrequel = prequel ? normalizePrequelConfig(prequel) : null
  const resolvedPrequel =
    prequels.find((item) => item.id === String(prequelId || '')) ||
    fallbackPrequel ||
    prequels[0] ||
    normalizePrequelConfig(game?.prequel)
  const resolvedPrequelId =
    resolvedPrequel.id || String(prequelId || '') || prequels[0]?.id || ''
  const progresses = getGameTeamPrequelProgresses(gameTeam, prequels)
  const existingProgress =
    progresses.find((item) => item.prequelId === resolvedPrequelId) ||
    (progresses.length === 1 ? progresses[0] : null)
  const progress = normalizePrequelProgress(
    existingProgress || {
      ...buildDefaultPrequelProgress(),
      prequelId: resolvedPrequelId,
    },
  )

  return {
    prequel: { ...resolvedPrequel, id: resolvedPrequelId },
    progress: { ...progress, prequelId: resolvedPrequelId },
  }
}

const applyPrequelSubmission = ({
  game,
  gameTeam,
  prequelId = '',
  prequel: providedPrequel = null,
  code,
  codeId = '',
  manualComplete = false,
  source = 'player',
  actorUserId = null,
  now = new Date(),
}) => {
  const { prequel, progress } = resolvePrequelAndProgress({
    game,
    gameTeam,
    prequelId,
    prequel: providedPrequel,
  })

  if (!prequel.enabled) {
    return { ok: false, status: 400, message: 'Приквел выключен', progress }
  }

  if (manualComplete) {
    if (progress.completedAt || isPrequelProgressClosedForConfig(progress, prequel)) {
      return {
        ok: false,
        status: 409,
        message: 'Приквел уже выполнен',
        progress,
      }
    }
    return {
      ok: true,
      status: 200,
      message: 'Приквел засчитан выполненным',
      progress: completePrequelProgress({
        progress,
        prequel,
        source: 'manual',
        actorUserId,
        now,
      }),
      completed: true,
    }
  }

  if (progress.completedAt || isPrequelProgressClosedForConfig(progress, prequel)) {
    return {
      ok: false,
      status: 409,
      message: 'Приквел для этой команды уже выполнен',
      progress,
    }
  }

  const allDefinitions = [
    ...(Array.isArray(prequel.mainCodes) ? prequel.mainCodes : []).map((item) => ({
      ...item,
      category: 'main',
    })),
    ...(Array.isArray(prequel.bonusCodes) ? prequel.bonusCodes : []).map((item) => ({
      ...item,
      category: 'bonus',
    })),
    ...(Array.isArray(prequel.penaltyCodes) ? prequel.penaltyCodes : []).map((item) => ({
      ...item,
      category: 'penalty',
    })),
  ]
  const forcedDefinition = codeId
    ? allDefinitions.find((item) => String(item.id || '') === String(codeId))
    : null
  const trimmedCode = String(forcedDefinition?.code ?? code ?? '').trim()
  const normalizedCode = normalizeCodeKey(trimmedCode)
  if (!normalizedCode) {
    return { ok: false, status: 400, message: 'Введите код приквела', progress }
  }

  const alreadyFound = [
    ...progress.foundMainCodes,
    ...progress.foundBonusCodes,
    ...progress.foundPenaltyCodes,
  ].some((item) => normalizeCodeKey(item) === normalizedCode)
  if (alreadyFound) {
    return {
      ok: false,
      status: 409,
      message: 'Этот код уже был активирован для команды',
      progress,
    }
  }

  const matchedItem =
    forcedDefinition ||
    allDefinitions.find((item) => normalizeCodeKey(item.code) === normalizedCode)
  const nextProgress = {
    ...progress,
    attempts: [...progress.attempts],
    foundMainCodes: [...progress.foundMainCodes],
    foundBonusCodes: [...progress.foundBonusCodes],
    foundPenaltyCodes: [...progress.foundPenaltyCodes],
    wrongCodes: [...progress.wrongCodes],
    appliedAdjustments: [...progress.appliedAdjustments],
    appliedStoryEffects: [...progress.appliedStoryEffects],
    lastSubmittedAt: now,
  }

  if (matchedItem) {
    const category = matchedItem.category
    nextProgress.attempts.push(
      createAttempt({
        index: nextProgress.attempts.length,
        code: trimmedCode,
        normalizedCode,
        category,
        matchedCode: matchedItem.code,
        source,
        actorUserId,
        now,
      }),
    )

    if (category === 'main') nextProgress.foundMainCodes.push(matchedItem.code)
    if (category === 'bonus') nextProgress.foundBonusCodes.push(matchedItem.code)
    if (category === 'penalty') nextProgress.foundPenaltyCodes.push(matchedItem.code)

    if (category === 'bonus' || category === 'penalty') {
      const adjustmentSource = `${category}_code`
      nextProgress.appliedAdjustments.push(
        createAdjustment({
          index: nextProgress.appliedAdjustments.length,
          type: category,
          source: adjustmentSource,
          code: matchedItem.code,
          codeId: matchedItem.id,
          value: Number(matchedItem.value) || 0,
          description: matchedItem.description || '',
          now,
        }),
      )
      appendStoryEffects({
        progress: nextProgress,
        effects: matchedItem.storyEffects,
        source: adjustmentSource,
        code: matchedItem.code,
        now,
      })
    }

    const hasMainCodes = resolveRequiredPrequelMainCodesCount(prequel) > 0
    const shouldComplete =
      (hasMainCodes && category === 'main' &&
        isPrequelProgressExhaustedForConfig(nextProgress, prequel)) ||
      (!hasMainCodes && prequel.mode === PREQUEL_MODE_SINGLE_HIT) ||
      (!hasMainCodes &&
        prequel.mode !== PREQUEL_MODE_SINGLE_HIT &&
        isPrequelProgressExhaustedForConfig(nextProgress, prequel))
    const completedProgress = shouldComplete
      ? completePrequelProgress({ progress: nextProgress, prequel, now })
      : nextProgress

    return {
      ok: true,
      status: 200,
      message:
        category === 'main'
          ? shouldComplete
            ? 'Основной код принят. Приквел выполнен!'
            : 'Основной код принят'
          : category === 'bonus'
            ? 'Бонусный код приквела принят'
            : 'Штрафной код приквела принят',
      progress: completedProgress,
      matchedCategory: category,
      completed: shouldComplete,
    }
  }

  nextProgress.attempts.push(
    createAttempt({
      index: nextProgress.attempts.length,
      code: trimmedCode,
      normalizedCode,
      category: 'wrong',
      source,
      actorUserId,
      now,
    }),
  )
  nextProgress.wrongCodes.push(trimmedCode)

  const wrongAttemptsLimit = Number(prequel.wrongAttemptsLimit) || 0
  const wrongAttemptsPenalty = Number(prequel.wrongAttemptsPenalty) || 0
  let newlyAppliedPenaltyCount = 0
  if (wrongAttemptsLimit > 0) {
    const totalPenaltyCount = Math.floor(
      nextProgress.wrongCodes.length / wrongAttemptsLimit,
    )
    newlyAppliedPenaltyCount = Math.max(
      0,
      totalPenaltyCount - (Number(nextProgress.wrongPenaltyAppliedCount) || 0),
    )
    for (let index = 0; index < newlyAppliedPenaltyCount; index += 1) {
      nextProgress.appliedAdjustments.push(
        createAdjustment({
          index: nextProgress.appliedAdjustments.length + index,
          type: 'penalty',
          source: 'wrong_attempts_limit',
          value: wrongAttemptsPenalty,
          description: `Штраф за ${wrongAttemptsLimit} неверных кодов приквела`,
          now,
        }),
      )
      appendStoryEffects({
        progress: nextProgress,
        effects: prequel.wrongAttemptsStoryEffects,
        source: 'wrong_attempts_limit',
        now,
      })
    }
    if (newlyAppliedPenaltyCount > 0) {
      nextProgress.wrongPenaltyAppliedCount = totalPenaltyCount
    }
  }

  return {
    ok: true,
    status: 200,
    message:
      newlyAppliedPenaltyCount > 0
        ? 'Код не подошёл. Начислен штраф за неверные коды.'
        : 'Код не подошёл',
    progress: nextProgress,
    matchedCategory: 'wrong',
  }
}

export { completePrequelProgress }
export default applyPrequelSubmission
