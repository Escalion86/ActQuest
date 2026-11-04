import { getClassicTaskEffectiveElapsedSeconds, resolveRequiredMainCodesCount } from '../helpers/classicGameRules.js'
import { getTimedCluesCountForTask } from '../helpers/taskTiming.js'
import { getClassicFoundMainCodesCount } from '../helpers/classicItemProgress.js'
import { getClassicEffectDefinition, getClassicEffectLabel, isClassicHelpEffect } from '../helpers/classicItemDefinitions.js'

export const waiveClassicPenalty = ({ team, task, taskIndex, stage, penalty, source, requestId, title, now }) => {
  stage.waivedPenalties ||= []
  stage.waivedPenalties.push({ key: penalty.key, seconds: penalty.seconds, source, requestId, at: now })
  team.timeAddings.push({ id: requestId, name: `${title}: снят штраф «${penalty.name}»`, time: -penalty.seconds, taskIndex, taskId: String(task._id || task.stageKey || taskIndex), source, scope: 'total_adjustment', showInAdjustments: true, createdAt: now })
}

export const applyClassicItemEffect = ({ game, team, task, taskIndex, stage, item, requestId, penalty, now }) => {
  const effect = item.effect
  const type = effect.type
  const elapsed = getClassicTaskEffectiveElapsedSeconds({ gameTeam: team, task, taskIndex, startTime: team.startTime[taskIndex], now })
  const visible = Math.min(task.clues?.length || 0, Math.max(team.forcedClues[taskIndex] || 0, getTimedCluesCountForTask(game, task, elapsed)))
  let seconds = 0
  let description = getClassicEffectLabel(effect)
  if (type === 'time_rewind' || type === 'time_freeze') {
    team.forcedClues[taskIndex] = visible
    seconds = type === 'time_rewind' ? -effect.seconds : 0
    team.timeAddings.push({ id: requestId, name: `${getClassicEffectDefinition(type).title}: ${item.title}`, time: -effect.seconds, taskIndex, taskId: String(task._id || task.stageKey || taskIndex), source: `item_${type}`, scope: 'task_elapsed', showInAdjustments: true, createdAt: now })
  } else if (type === 'free_clue') {
    team.forcedClues[taskIndex] = visible + 1
    description = `Подсказка №${visible + 1} открыта бесплатно`
  } else if (isClassicHelpEffect(type)) {
    stage.revealedHelp ||= []
    stage.revealedHelp.push({ id: requestId, itemId: item.id, title: item.title, type, text: effect.text || '', image: effect.image || '', at: now })
  } else if (type === 'penalty_shield') {
    stage.shields ||= []
    stage.shields.push({ requestId, title: item.title, at: now })
    description = 'Щит защитит от следующего штрафа за код или подбор на этом задании'
  } else if (type === 'penalty_erase') {
    waiveClassicPenalty({ team, task, taskIndex, stage, penalty, source: 'item_penalty_erase', requestId, title: `Ластик «${item.title}»`, now })
    description = `Снят штраф «${penalty.name}»`
    seconds = -penalty.seconds
  } else if (type === 'lockpick') {
    stage.virtualCodes = (stage.virtualCodes || 0) + 1
    description = 'Один обязательный код закрыт отмычкой'
    if (getClassicFoundMainCodesCount(team, task, taskIndex) >= resolveRequiredMainCodesCount(task)) {
      stage.completionSource = 'lockpick'
      team.endTime[taskIndex] = now
    }
  } else if (type === 'portal') {
    stage.completionSource = 'portal'
    team.endTime[taskIndex] = now
    description = 'Задание завершено порталом без штрафа за провал'
  }
  return { seconds, description }
}
