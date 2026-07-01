import {
  PREQUEL_MODE_SINGLE_HIT,
  isPrequelOpenForDate,
  isPrequelReadyForPlayers,
  isPrequelProgressClosedForConfig,
  isPrequelProgressExhaustedForConfig,
  normalizePrequelConfig,
  normalizePrequelProgress,
} from '@helpers/normalizePrequel'

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
  now,
}) => ({
  id: `prequel-attempt-${Date.now()}-${index}`,
  code,
  normalizedCode,
  category,
  matchedCode,
  createdAt: now,
})

const createAdjustment = ({
  index,
  type,
  source,
  code = '',
  value = 0,
  description = '',
  now,
}) => ({
  id: `prequel-adjustment-${Date.now()}-${index}`,
  type,
  source,
  code,
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

const applyPrequelSubmission = ({ game, gameTeam, code, now = new Date() }) => {
  const prequel = normalizePrequelConfig(game?.prequel)
  if (!prequel.enabled) {
    return {
      ok: false,
      status: 400,
      message: 'Приквел для этой игры выключен',
      progress: normalizePrequelProgress(gameTeam?.prequelProgress),
    }
  }

  if (!isPrequelReadyForPlayers(prequel)) {
    return {
      ok: false,
      status: 400,
      message: 'Приквел заполнен не полностью',
      progress: normalizePrequelProgress(gameTeam?.prequelProgress),
    }
  }

  if (!isPrequelOpenForDate(prequel, now)) {
    return {
      ok: false,
      status: 423,
      message: 'Приквел ещё не открыт',
      progress: normalizePrequelProgress(gameTeam?.prequelProgress),
    }
  }

  const progress = normalizePrequelProgress(gameTeam?.prequelProgress)
  const isClosedForCurrentConfig = isPrequelProgressClosedForConfig(
    progress,
    prequel,
  )
  const isExhaustedForCurrentConfig = isPrequelProgressExhaustedForConfig(
    progress,
    prequel,
  )
  const effectiveProgress = isClosedForCurrentConfig
    ? progress
    : {
        ...progress,
        isClosed: false,
        closedReason:
          progress.closedReason === 'single_hit_resolved'
            ? null
            : progress.closedReason,
      }
  const trimmedCode = String(code || '').trim()
  const normalizedCode = normalizeCodeKey(trimmedCode)

  if (!normalizedCode) {
    return {
      ok: false,
      status: 400,
      message: 'Введите код приквела',
      progress: effectiveProgress,
    }
  }

  const alreadyFound = [
    ...effectiveProgress.foundBonusCodes,
    ...effectiveProgress.foundPenaltyCodes,
  ].some((item) => normalizeCodeKey(item) === normalizedCode)

  if (alreadyFound) {
    return {
      ok: false,
      status: 409,
      message: 'Этот код приквела уже был найден вашей командой',
      progress: effectiveProgress,
    }
  }

  if (isExhaustedForCurrentConfig) {
    return {
      ok: false,
      status: 409,
      message: 'Все коды приквела для этой команды уже найдены',
      progress: {
        ...effectiveProgress,
        isClosed: true,
        closedReason: 'all_codes_found',
      },
    }
  }

  if (isClosedForCurrentConfig) {
    return {
      ok: false,
      status: 409,
      message: 'Ввод приквела для этой команды уже закрыт',
      progress: effectiveProgress,
    }
  }

  const bonusCode = (Array.isArray(prequel.bonusCodes) ? prequel.bonusCodes : []).find(
    (item) => normalizeCodeKey(item.code) === normalizedCode,
  )
  const penaltyCode = (
    Array.isArray(prequel.penaltyCodes) ? prequel.penaltyCodes : []
  ).find((item) => normalizeCodeKey(item.code) === normalizedCode)

  const nextProgress = {
    ...effectiveProgress,
    attempts: [...effectiveProgress.attempts],
    foundBonusCodes: [...effectiveProgress.foundBonusCodes],
    foundPenaltyCodes: [...effectiveProgress.foundPenaltyCodes],
    wrongCodes: [...effectiveProgress.wrongCodes],
    appliedAdjustments: [...effectiveProgress.appliedAdjustments],
    appliedStoryEffects: [...effectiveProgress.appliedStoryEffects],
    lastSubmittedAt: now,
  }

  if (bonusCode || penaltyCode) {
    const matchedItem = bonusCode || penaltyCode
    const isBonus = Boolean(bonusCode)
    const source = isBonus ? 'bonus_code' : 'penalty_code'

    nextProgress.attempts.push(
      createAttempt({
        index: nextProgress.attempts.length,
        code: trimmedCode,
        normalizedCode,
        category: isBonus ? 'bonus' : 'penalty',
        matchedCode: matchedItem.code,
        now,
      }),
    )

    if (isBonus) {
      nextProgress.foundBonusCodes.push(matchedItem.code)
    } else {
      nextProgress.foundPenaltyCodes.push(matchedItem.code)
    }

    nextProgress.appliedAdjustments.push(
      createAdjustment({
        index: nextProgress.appliedAdjustments.length,
        type: isBonus ? 'bonus' : 'penalty',
        source,
        code: matchedItem.code,
        value: Number(matchedItem.value) || 0,
        description: matchedItem.description || '',
        now,
      }),
    )

    ;(Array.isArray(matchedItem.storyEffects) ? matchedItem.storyEffects : []).forEach(
      (effect, index) => {
        nextProgress.appliedStoryEffects.push(
          createAppliedStoryEffect({
            index: nextProgress.appliedStoryEffects.length + index,
            effect,
            source,
            code: matchedItem.code,
            now,
          }),
        )
      },
    )

    if (prequel.mode === PREQUEL_MODE_SINGLE_HIT) {
      nextProgress.isClosed = true
      nextProgress.closedReason = 'single_hit_resolved'
    } else if (isPrequelProgressExhaustedForConfig(nextProgress, prequel)) {
      nextProgress.isClosed = true
      nextProgress.closedReason = 'all_codes_found'
    }

    return {
      ok: true,
      status: 200,
      message: isBonus
        ? 'Бонусный код приквела принят'
        : 'Штрафной код приквела принят',
      progress: nextProgress,
      matchedCategory: isBonus ? 'bonus' : 'penalty',
    }
  }

  nextProgress.attempts.push(
    createAttempt({
      index: nextProgress.attempts.length,
      code: trimmedCode,
      normalizedCode,
      category: 'wrong',
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

    if (newlyAppliedPenaltyCount > 0) {
      for (let index = 0; index < newlyAppliedPenaltyCount; index += 1) {
        nextProgress.appliedAdjustments.push(
          createAdjustment({
            index: nextProgress.appliedAdjustments.length + index,
            type: 'penalty',
            source: 'wrong_attempts_limit',
            code: '',
            value: wrongAttemptsPenalty,
            description: `Штраф за ${wrongAttemptsLimit} неверных кодов приквела`,
            now,
          }),
        )

        ;(
          Array.isArray(prequel.wrongAttemptsStoryEffects)
            ? prequel.wrongAttemptsStoryEffects
            : []
        ).forEach((effect, effectIndex) => {
          nextProgress.appliedStoryEffects.push(
            createAppliedStoryEffect({
              index:
                nextProgress.appliedStoryEffects.length + index + effectIndex,
              effect,
              source: 'wrong_attempts_limit',
              code: '',
              now,
            }),
          )
        })
      }

      nextProgress.wrongPenaltyAppliedCount = totalPenaltyCount
    }
  }

  return {
    ok: true,
    status: 200,
    message:
      newlyAppliedPenaltyCount > 0
        ? 'Код не подошёл. За превышение лимита неверных кодов начислен штраф.'
        : 'Код не подошёл',
    progress: nextProgress,
    matchedCategory: 'wrong',
  }
}

export default applyPrequelSubmission
