import { getClassicTaskEffectiveElapsedSeconds, resolveRequiredMainCodesCount } from './classicGameRules.js'
import { getTaskDurationSeconds, getTimedCluesCountForTask } from './taskTiming.js'
import { getClassicEffectValidationError, isClassicHelpEffect } from './classicItemDefinitions.js'
import { getClassicItemStage, getClassicFoundMainCodesCount, getClassicPenaltyCandidates } from './classicItemProgress.js'
import { getActiveTaskFreeze } from './taskTimeAdjustments.js'
import { resolveClassicTask } from './classicVariants.js'

export const getClassicItemUseBlockReason = ({ item, game, gameTeam, task, taskIndex, stageId, isCaptain, now = new Date() }) => {
  if (!isCaptain) return 'Применить предмет может только капитан.'
  if (game.status !== 'started') return 'Игра сейчас недоступна для действий.'
  if (!task || task.canceled || !gameTeam.startTime?.[taskIndex] || gameTeam.endTime?.[taskIndex] ||
    gameTeam.taskFailures?.some((entry) => entry.taskIndex === taskIndex && entry.failedAt)) return 'Предмет доступен только на активном задании.'
  const effect = item?.effect
  if (!effect || getClassicEffectValidationError(effect)) return 'У предмета нет доступного эффекта.'
  if (effect.allowedStageIds?.length && !effect.allowedStageIds.includes(stageId)) return 'Этот предмет нельзя применить на текущем задании.'
  if (task.variantConfig?.enabled && !gameTeam.classicProgress?.stages?.some((entry) => entry.stageId === stageId && entry.selectedVariantId)) return 'Сначала выберите путь задания.'
  if (!(gameTeam.classicProgress?.inventory?.find((entry) => entry.itemId === item.id)?.quantity > 0)) return 'Предмета больше нет в инвентаре.'
  const content = resolveClassicTask(task, gameTeam, taskIndex)
  const stage = getClassicItemStage(gameTeam, task, taskIndex)
  const elapsed = getClassicTaskEffectiveElapsedSeconds({ gameTeam, task, taskIndex, startTime: gameTeam.startTime[taskIndex], now })
  const duration = getTaskDurationSeconds(game, task)
  if (duration > 0 && elapsed >= duration) return 'Время задания уже истекло.'
  if (effect.type === 'time_rewind' && elapsed < effect.seconds) return `Для применения должно пройти ${effect.seconds / 60} мин. игрового времени.`
  if (effect.type === 'time_freeze' && getActiveTaskFreeze({ timeAddings: gameTeam.timeAddings, taskIndex, task, now })) return 'Заморозка времени уже действует на этом задании.'
  if (effect.type === 'free_clue' && Math.max(gameTeam.forcedClues?.[taskIndex] || 0, getTimedCluesCountForTask(game, content, elapsed)) >= (content.clues?.length || 0)) return 'Все подсказки этого задания уже открыты.'
  if (effect.type === 'penalty_erase' && !getClassicPenaltyCandidates(game, gameTeam, content, taskIndex).length) return 'На этом задании нет штрафа за код или подбор, который можно снять.'
  if (effect.type === 'lockpick' && getClassicFoundMainCodesCount(gameTeam, content, taskIndex) >= resolveRequiredMainCodesCount(content)) return 'Все обязательные коды уже закрыты.'
  if (isClassicHelpEffect(effect.type) && stage?.revealedHelp?.some((entry) => entry.itemId === item.id)) return 'Помощь этого предмета уже открыта на задании.'
  return null
}
