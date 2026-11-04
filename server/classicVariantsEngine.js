import { classicStageId, getClassicStageProgress, getClassicVariantChoices, resolveClassicTask } from '../helpers/classicVariants.js'
import { normalizeClassicCode, resolveRequiredMainCodesCount, getClassicTaskEffectiveElapsedSeconds, getClassicTaskTimeAdjustmentSeconds, resolveForceClueCost } from '../helpers/classicGameRules.js'
import { buildLinearTaskSequence } from '../helpers/taskDistribution.js'
import { getClassicItemUseBlockReason } from '../helpers/classicItemEffects.js'
import { getTaskDurationSeconds, getClueTimesSeconds, getTimedCluesCountForTask } from '../helpers/taskTiming.js'
import { applyClassicItemEffect, waiveClassicPenalty } from './classicItemEffectActions.js'
import { getClassicPenaltyCandidates, getClassicFoundMainCodesCount } from '../helpers/classicItemProgress.js'
import { getTimeAddingSeconds, isTimeAddingForTask, isTaskTimeAdjustment } from '../helpers/taskTimeAdjustments.js'

export const CLASSIC_PROGRESS_FIELDS = ['activeNum', 'taskSequence', 'startTime', 'endTime', 'findedCodes', 'findedBonusCodes', 'findedPenaltyCodes', 'wrongCodes', 'codeAttempts', 'forcedClues', 'taskFailures', 'timeAddings', 'classicProgress']
const clone = (value) => JSON.parse(JSON.stringify(value))
const stamp = (value) => new Date(value).getTime()

// Все изменения рассчитываются в памяти и сохраняются одной записью документа.
export const runClassicVariants = ({ game, gameTeam, action, message, stageId, variantId, itemId, requestId, penaltyKey, isCaptain = false, isAdmin = false, actorId = null, now = new Date(), dynamicTimeCode }) => {
  const team = clone(gameTeam)
  const reply = { message: '', statusCode: 200 }
  const fail = (text, statusCode = 409) => Object.assign(reply, { message: text, statusCode })
  if (game.status !== 'started') {
    if (action || message) fail('Игра сейчас недоступна для действий.', 409)
    return { gameTeam: team, result: reply }
  }
  const count = game.tasks.length
  // Движок вариантов проходит этапы линейно; старый случайный маршрут не должен менять экран.
  team.taskSequence = buildLinearTaskSequence(count)
  for (const key of ['startTime', 'endTime', 'findedCodes', 'findedBonusCodes', 'findedPenaltyCodes', 'wrongCodes', 'forcedClues']) {
    team[key] = Array.from({ length: count }, (_, i) => team[key]?.[i] ?? (key.startsWith('finded') || key === 'wrongCodes' ? [] : key === 'forcedClues' ? 0 : null))
  }
  team.taskFailures ||= []
  team.timeAddings ||= []
  team.codeAttempts ||= []
  team.activeNum = Number.isInteger(team.activeNum) ? team.activeNum : 0
  team.classicProgress ||= { version: 1, inventory: [], stages: [], history: [] }
  const progress = team.classicProgress
  progress.inventory ||= []; progress.stages ||= []; progress.history ||= []
  const record = (index) => {
    let entry = getClassicStageProgress(team, game.tasks[index], index)
    if (!entry) {
      entry = { stageId: classicStageId(game.tasks[index], index), selectedVariantId: null, outcome: null }
      progress.stages.push(entry)
    }
    return entry
  }
  const event = (key, type, index, at, extra = {}) => {
    if (progress.history.some((entry) => entry.key === key)) return false
    progress.history.push({ key, type, stageId: classicStageId(game.tasks[index], index), at, actorId, ...extra })
    return true
  }
  const changeItems = (entries, direction) => {
    for (const entry of entries || []) {
      const item = game.classicItems?.find((item) => item.id === entry.itemId)
      if (!item) throw new Error('Предмет сценария не найден.')
      let balance = progress.inventory.find((item) => item.itemId === entry.itemId)
      if (!balance) { balance = { itemId: entry.itemId, quantity: 0 }; progress.inventory.push(balance) }
      const next = balance.quantity + direction * entry.quantity
      if (!Number.isSafeInteger(next) || next < 0) throw new Error('Недостаточно предметов или неверное количество.')
      balance.quantity = item.kind === 'unique' ? Math.min(next, 1) : next
    }
  }
  const grant = (entries, key, index, at) => {
    if (!entries?.length || !event(key, 'items_granted', index, at, { items: entries })) return
    changeItems(entries, 1)
  }
  const select = (index, variant, method, at) => {
    const entry = record(index)
    if (entry.selectedVariantId) return
    changeItems(variant.consumeItems, -1)
    Object.assign(entry, { selectedVariantId: variant.id, selectedAt: at, selectionMode: method, selectedBy: method === 'auto' ? null : actorId, selectionReason: method === 'auto' ? variant.id === 'default' ? 'Запасной путь' : 'Первый доступный вариант по приоритету' : 'Решение капитана' })
    event(`select:${entry.stageId}`, 'variant_selected', index, at, { variantId: variant.id, title: variant.title, method, reason: entry.selectionReason, items: variant.consumeItems || [] })
  }
  const finish = (index, outcome, at) => {
    const entry = record(index)
    if (entry.outcome) return
    entry.outcome = outcome
    const task = game.tasks[index]
    for (const adding of team.timeAddings) {
      if (adding.source === 'item_time_freeze' && isTimeAddingForTask(adding, index, task)) adding.time = getTimeAddingSeconds(adding, at)
    }
    event(`outcome:${entry.stageId}`, 'stage_finished', index, at, { outcome, variantId: entry.selectedVariantId })
    grant(task.outcomeRewards?.[outcome], `stage-reward:${entry.stageId}`, index, at)
    if (entry.selectedVariantId) grant(resolveClassicTask(task, team, index).itemRewards?.[outcome], `variant-reward:${entry.stageId}`, index, at)
  }
  const failure = (index, source, at) => {
    if (!team.taskFailures.some((entry) => entry.taskIndex === index)) team.taskFailures.push({ taskIndex: index, taskId: classicStageId(game.tasks[index], index), failedAt: at, source, reason: source === 'timeout' ? 'task_timeout' : 'captain_fail_task' })
  }
  const advance = (index, at) => {
    team.activeNum = index + 1
    if (index + 1 < count && !team.startTime[index + 1]) team.startTime[index + 1] = at
  }
  const tick = () => {
    for (let guard = 0; guard <= count && team.activeNum < count; guard++) {
      const index = team.activeNum
      const task = game.tasks[index]
      if (!team.startTime[index]) team.startTime[index] = now
      if (task.canceled) { const entry = record(index); if (!entry.outcome) entry.outcome = 'canceled'; advance(index, team.startTime[index]); continue }
      const entry = record(index)
      if (!entry.selectedVariantId) {
        const choices = getClassicVariantChoices(game, team, index)
        if (!task.variantConfig?.enabled || task.variantConfig.mode === 'auto' || choices.length === 1) select(index, choices[0], 'auto', team.startTime[index])
      }
      const effective = resolveClassicTask(task, team, index)
      const duration = getTaskDurationSeconds(game, task)
      let failed = team.taskFailures.find((entry) => entry.taskIndex === index)
      if (!team.endTime[index] && !failed && duration > 0) {
        const elapsed = getClassicTaskEffectiveElapsedSeconds({ gameTeam: team, task: effective, taskIndex: index, startTime: team.startTime[index], now })
        if (elapsed >= duration) {
          const extra = getClassicTaskTimeAdjustmentSeconds({ gameTeam: team, task: effective, taskIndex: index, now })
          const lastAdvanceAt = Math.max(0, ...team.timeAddings.filter((adding) => isTaskTimeAdjustment(adding) && Number(adding.time) > 0 && isTimeAddingForTask(adding, index, effective)).map((adding) => stamp(adding.createdAt) || 0))
          const at = new Date(Math.max(lastAdvanceAt, stamp(team.startTime[index]) + Math.max(duration - extra, 0) * 1000))
          failure(index, 'timeout', at)
          failed = team.taskFailures.find((entry) => entry.taskIndex === index)
        }
      }
      const ended = team.endTime[index] || failed?.failedAt
      if (!ended) break
      finish(index, team.endTime[index] ? 'completed' : failed.source === 'timeout' ? 'timeout' : 'captain_failed', ended)
      const nextAt = new Date(stamp(ended) + Math.max(Number(game.breakDuration) || 0, 0) * 1000)
      if (index === count - 1 || stamp(now) >= stamp(nextAt)) { advance(index, nextAt); continue }
      break
    }
  }
  const originalStep = team.activeNum
  tick()
  const index = team.activeNum
  const task = game.tasks[index]
  const mutation = action || message
  const requestedIndex = stageId ? game.tasks.findIndex((task, i) => classicStageId(task, i) === stageId) : index
  const previousUse = action === 'useItem' && requestId && progress.history.find((entry) => entry.key === `use-item:${requestId}`)
  if (previousUse && isCaptain) {
    if (previousUse.itemId !== itemId || previousUse.stageId !== stageId || (previousUse.penaltyKey || null) !== (penaltyKey || null)) fail('Идентификатор запроса уже использован для другого действия.', 400)
    else reply.message = 'Предмет уже применён.'
    return { gameTeam: team, result: reply }
  }
  if (action === 'selectVariant' && isCaptain && requestedIndex >= 0 && record(requestedIndex).selectedVariantId === variantId) {
    return { gameTeam: team, result: reply }
  }
  if (mutation && (index !== originalStep || !task || (stageId && requestedIndex !== index))) fail('Этап уже изменился. Обновите экран.')
  else if (action && !isCaptain) fail('Это действие доступно только капитану.', 403)
  else if (['forceClue', 'failTask', 'finishBreak'].includes(action) && !stageId) fail('Не указан этап капитанского действия. Обновите экран.', 400)
  else if (task && mutation) {
    const entry = record(index)
    const ended = team.endTime[index] || team.taskFailures.find((entry) => entry.taskIndex === index)?.failedAt
    const effective = resolveClassicTask(task, team, index)
    if (action === 'finishBreak') {
      if (!ended || game.allowCaptainFinishBreak === false || index === count - 1) fail('Завершение перерыва недоступно.')
      else { advance(index, now); reply.message = 'Перерыв завершён.' }
    } else if (ended) fail('Этап уже завершён.')
    else if (isAdmin && action === 'force_complete') {
      if (!entry.selectedVariantId) fail('Сначала команда должна выбрать вариант.')
      else { team.endTime[index] = now; reply.message = 'Задание завершено администратором.' }
    } else if (isAdmin && action === 'force_fail') {
      failure(index, 'admin', now); reply.message = 'Задание провалено администратором.'
    }
    else if (action === 'useItem') {
      const item = game.classicItems?.find((entry) => entry.id === itemId)
      const reason = getClassicItemUseBlockReason({ item, game, gameTeam: team, task, taskIndex: index, stageId: classicStageId(task, index), isCaptain, now })
      const penalty = item?.effect?.type === 'penalty_erase' ? getClassicPenaltyCandidates(game, team, effective, index).find((entry) => entry.key === penaltyKey) : null
      if (!stageId || !itemId || typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) fail('Не указаны предмет, этап или идентификатор применения.', 400)
      else if (reason) fail(reason)
      else if (item.effect.type === 'penalty_erase' && !penalty) fail('Выберите доступный штраф текущего задания.', 400)
      else {
        changeItems([{ itemId, quantity: 1 }], -1)
        const applied = applyClassicItemEffect({ game, team, task: effective, taskIndex: index, stage: entry, item, requestId, penalty, now })
        event(`use-item:${requestId}`, 'item_used', index, now, { itemId, itemTitle: item.title, effect: clone(item.effect), penaltyKey: penaltyKey || null, ...applied, items: [{ itemId, quantity: 1 }] })
        reply.message = item.effect.type === 'time_rewind' ? `Предмет «${item.title}» применён. Время задания уменьшено на ${item.effect.seconds / 60} мин.` : `Предмет «${item.title}» применён. ${applied.description}.`
      }
    }
    else if (action === 'selectVariant') {
      const chosen = getClassicVariantChoices(game, team, index).find((v) => v.id === variantId)
      if (!stageId || !variantId) fail('Не указан этап или вариант.', 400)
      else if (entry.selectedVariantId || !chosen || task.variantConfig?.mode !== 'captain') fail('Этот вариант сейчас недоступен.')
      else { select(index, chosen, 'captain', now); reply.message = 'Вариант выбран.' }
    } else if (action === 'failTask' || action === 'forceClue') {
      const clueTimes = getClueTimesSeconds(game, effective)
      const elapsed = getClassicTaskEffectiveElapsedSeconds({ gameTeam: team, task: effective, taskIndex: index, startTime: team.startTime[index], now })
      const visible = Math.max(team.forcedClues[index] || 0, getTimedCluesCountForTask(game, effective, elapsed))
      const total = effective.clues?.length || 0
      if (action === 'failTask') {
        if (game.allowCaptainFailTask === false || (entry.selectedVariantId && visible < total)) fail('Слив доступен после получения всех подсказок.')
        else { failure(index, 'captain', now); reply.message = 'Задание провалено по решению команды.' }
      } else if (!entry.selectedVariantId || game.allowCaptainForceClue === false || !clueTimes.length || visible >= total || visible + 1 < Number(game.clueEarlyAccessFrom || 1)) fail('Досрочная подсказка недоступна.')
      else {
        const cost = resolveForceClueCost({ mode: game.clueEarlyAccessMode, configuredPenaltySeconds: game.clueEarlyPenalty, secondsUntilNextClue: clueTimes[visible] - elapsed })
        team.forcedClues[index] = visible + 1
        team.timeAddings.push({ name: `Досрочная подсказка №${visible + 1}`, time: cost.seconds, taskIndex: index, taskId: classicStageId(task, index), source: 'captain_force_clue', scope: 'task_elapsed', showInAdjustments: false, createdAt: now })
        reply.message = `Подсказка №${visible + 1} выдана досрочно.`
      }
    } else if (action) fail('Неизвестное действие.', 400)
    else if (!entry.selectedVariantId) fail('Сначала капитан должен выбрать вариант.')
    else if (message) {
      const code = normalizeClassicCode(message)
      const bonus = effective.bonusCodes?.find((entry) => normalizeClassicCode(entry.code) === code)
      const penalty = effective.penaltyCodes?.find((entry) => normalizeClassicCode(entry.code) === code)
      const main = (effective.codes || []).some((value) => normalizeClassicCode(value) === code) || (effective.codes?.[0] === '[time]' && code === dynamicTimeCode)
      const category = bonus ? 'bonus' : penalty ? 'penalty' : main ? 'main' : 'wrong'
      const key = { bonus: 'findedBonusCodes', penalty: 'findedPenaltyCodes', main: 'findedCodes', wrong: 'wrongCodes' }[category]
      if (category !== 'wrong' && team[key][index].some((value) => normalizeClassicCode(value) === code)) fail('Такой код уже найден.', 400)
      else {
        const penaltiesBefore = new Set(getClassicPenaltyCandidates(game, team, effective, index).map((entry) => entry.key))
        team[key][index].push(code)
        team.codeAttempts.push({ taskIndex: index, code, category, status: category === 'wrong' ? 'rejected' : 'accepted', source: 'web', createdAt: now })
        reply.message = category === 'wrong' ? 'Код не верен.' : category === 'bonus' ? 'Бонусный код принят.' : category === 'penalty' ? 'Штрафной код принят.' : 'Код принят.'
        if (category === 'wrong' && isAdmin) reply.statusCode = 400
        if (category !== 'wrong') {
          const rewards = (effective.itemRewards?.codes || []).filter((reward) => reward.category === category && normalizeClassicCode(reward.code) === code).flatMap((reward) => reward.items || [])
          grant(rewards, `code:${entry.stageId}:${entry.selectedVariantId}:${category}:${code}`, index, now)
          if (category === 'main' && getClassicFoundMainCodesCount(team, effective, index) >= resolveRequiredMainCodesCount(effective)) team.endTime[index] = now
        }
        const newPenalty = getClassicPenaltyCandidates(game, team, effective, index).find((entry) => !penaltiesBefore.has(entry.key))
        if (newPenalty && entry.shields?.length) {
          const shield = entry.shields.shift()
          waiveClassicPenalty({ team, task: effective, taskIndex: index, stage: entry, penalty: newPenalty, source: 'item_penalty_shield', requestId: `shield:${entry.stageId}:${newPenalty.key}`, title: `Щит «${shield.title}»`, now })
          event(`shield:${entry.stageId}:${newPenalty.key}`, 'penalty_blocked', index, now, { itemTitle: shield.title, description: `Щит нейтрализовал штраф «${newPenalty.name}»`, seconds: -newPenalty.seconds })
          reply.message += ' Штраф нейтрализован щитом.'
        }
      }
    }
  }
  tick()
  return { gameTeam: team, result: reply }
}
