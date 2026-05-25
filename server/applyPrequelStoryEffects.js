import {
  buildInitialStoryProgress,
  changeStoryScore,
  grantStoryItem,
  unlockStoryNode,
} from '@server/storyEngine'
import { normalizePrequelStoryEffect } from '@helpers/normalizePrequel'

const createFlagHistoryEntry = ({ progress, effect, now, sourceCode, sourceLabel }) => ({
  ...progress,
  prequelFlags: Array.from(
    new Set([...(Array.isArray(progress?.prequelFlags) ? progress.prequelFlags : []), effect.flagKey]),
  ),
  history: [
    ...(Array.isArray(progress?.history) ? progress.history : []),
    {
      id: `story-prequel-flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'prequel_flag_set',
      at: now,
      nodeId: null,
      itemId: null,
      actionId: null,
      codeId: null,
      clueId: null,
      endingId: null,
      points: 0,
      message: sourceLabel
        ? `Приквел: установлен флаг ${effect.flagKey} (${sourceLabel})`
        : `Приквел: установлен флаг ${effect.flagKey}${sourceCode ? ` по коду ${sourceCode}` : ''}`,
      actor: 'system',
    },
  ],
})

const applySingleStoryEffect = ({
  game,
  progress,
  effect,
  now = new Date(),
  sourceCode = '',
  sourceLabel = '',
}) => {
  const normalizedEffect = normalizePrequelStoryEffect(effect)

  if (normalizedEffect.type === 'grant_item') {
    return grantStoryItem({
      game,
      progress,
      itemId: normalizedEffect.itemId,
      actor: 'system',
      now,
    })
  }

  if (normalizedEffect.type === 'unlock_node') {
    return unlockStoryNode({
      game,
      progress,
      nodeId: normalizedEffect.nodeId,
      actor: 'system',
      now,
    })
  }

  if (normalizedEffect.type === 'score_modifier') {
    return changeStoryScore({
      progress,
      points: normalizedEffect.value,
      reason: 'prequel_score_modifier',
      actor: 'system',
      now,
      message: sourceLabel
        ? `Приквел: ${sourceLabel}`
        : `Приквел${sourceCode ? `: код ${sourceCode}` : ''}`,
    })
  }

  if (normalizedEffect.type === 'set_flag') {
    if (!normalizedEffect.flagKey) {
      return { progress, applied: false, reason: 'flag_key_missing' }
    }

    const existingFlags = Array.isArray(progress?.prequelFlags) ? progress.prequelFlags : []
    if (existingFlags.includes(normalizedEffect.flagKey)) {
      return { progress, applied: false, reason: 'flag_already_set' }
    }

    return {
      progress: createFlagHistoryEntry({
        progress,
        effect: normalizedEffect,
        now,
        sourceCode,
        sourceLabel,
      }),
      applied: true,
    }
  }

  return { progress, applied: false, reason: 'unsupported_effect' }
}

const applyPrequelStoryEffects = ({
  game,
  progress,
  effects = [],
  now = new Date(),
  sourceCode = '',
  sourceLabel = '',
}) => {
  let nextProgress =
    progress && typeof progress === 'object'
      ? progress
      : buildInitialStoryProgress(game, { actor: 'system', now })
  const appliedEffects = []

  ;(Array.isArray(effects) ? effects : []).forEach((effect) => {
    const normalizedEffect = normalizePrequelStoryEffect(effect)
    const result = applySingleStoryEffect({
      game,
      progress: nextProgress,
      effect: normalizedEffect,
      now,
      sourceCode,
      sourceLabel,
    })

    nextProgress = result.progress
    if (result.applied) {
      appliedEffects.push(normalizedEffect)
    }
  })

  return {
    progress: nextProgress,
    appliedEffects,
  }
}

export default applyPrequelStoryEffects
