import { normalizeClassicCode, getRequiredMainCodesValidationError } from './classicGameRules.js'

export const classicStageId = (task, index) => String(task?.stageKey || task?._id || task?.id || index)
export const hasClassicVariants = (game) => game?.type === 'classic' && (
  (game.classicItems || []).length > 0 ||
  (game.tasks || []).some((task) => task.variantConfig?.enabled || task.itemRewards || task.outcomeRewards)
)
export const getClassicStageProgress = (team, task, index) =>
  team?.classicProgress?.stages?.find((entry) => entry.stageId === classicStageId(task, index))

// Пустое содержимое до назначения не раскрывает запасное задание.
export const resolveClassicTask = (task, team, index) => {
  if (!task?.variantConfig?.enabled) return task
  const selected = getClassicStageProgress(team, task, index)?.selectedVariantId
  const content = selected === 'default' ? task : task.variants?.find((v) => v.id === selected)?.content
  return {
    ...(content || {}), _id: task._id, canceled: task.canceled, isBonusTask: task.isBonusTask,
    selectedVariantId: selected || null,
    variantTitle: selected === 'default' ? task.variantConfig?.title || 'Обычный путь'
      : task.variants?.find((v) => v.id === selected)?.title || '',
  }
}
export const resolveClassicGame = (game, team) => !hasClassicVariants(game) ? game : ({
  ...game, tasks: game.tasks.map((task, index) => resolveClassicTask(task, team, index)),
})
export const classicItemQuantity = (team, id) =>
  team?.classicProgress?.inventory?.find((entry) => entry.itemId === id)?.quantity || 0

const conditionMet = (condition, game, team) => {
  if (condition.type === 'item') {
    const enough = classicItemQuantity(team, condition.itemId) >= condition.quantity
    return condition.absent ? !enough : enough
  }
  const index = game.tasks.findIndex((task, i) => classicStageId(task, i) === condition.stageId)
  if (index < 0) return false
  const progress = getClassicStageProgress(team, game.tasks[index], index)
  const variantMatches = !condition.variantId || progress?.selectedVariantId === condition.variantId
  if (condition.type === 'outcome') return variantMatches && progress?.outcome === condition.outcome
  const key = { main: 'findedCodes', bonus: 'findedBonusCodes', penalty: 'findedPenaltyCodes' }[condition.category]
  const found = variantMatches && (team[key]?.[index] || []).some((code) => normalizeClassicCode(code) === normalizeClassicCode(condition.code))
  return condition.absent ? !found : found
}
export const getClassicVariantChoices = (game, team, index) => {
  const task = game.tasks[index]
  if (!task?.variantConfig?.enabled) return [{ id: 'default', title: task?.title || 'Задание', consumeItems: [] }]
  const candidates = (task.variants || []).filter((variant) => {
    const rules = variant.conditions?.rules || []
    const matched = !rules.length || (variant.conditions?.mode === 'any'
      ? rules.some((rule) => conditionMet(rule, game, team))
      : rules.every((rule) => conditionMet(rule, game, team)))
    return matched && (variant.consumeItems || []).every((cost) => classicItemQuantity(team, cost.itemId) >= cost.quantity)
  })
  if (!candidates.length || (task.variantConfig.mode === 'captain' && task.variantConfig.offerDefaultAlways)) {
    candidates.push({ id: 'default', title: task.variantConfig.title || 'Обычный путь', description: task.variantConfig.description || '', consumeItems: [] })
  }
  return candidates
}
export const classicPublicInventory = (game, team) => (team?.classicProgress?.inventory || [])
  .filter((entry) => entry.quantity > 0)
  .map((entry) => {
    const item = game.classicItems?.find((item) => item.id === entry.itemId)
    return { itemId: entry.itemId, quantity: entry.quantity, title: item?.title || '', description: item?.description || '' }
  })
export const classicPublicChoices = (game, team, index) => getClassicVariantChoices(game, team, index).map((variant) => ({
  id: variant.id, title: variant.title, description: variant.description || '',
  consumeItems: (variant.consumeItems || []).map((cost) => ({ ...cost, title: game.classicItems?.find((item) => item.id === cost.itemId)?.title || '' })),
}))

const validateClassicVariantsUnchecked = (game) => {
  const errors = []
  const items = game.classicItems || []
  const tasks = game.tasks || []
  const enabled = items.length || tasks.some((task) => task.variantConfig?.enabled || task.itemRewards || task.outcomeRewards)
  if (!enabled) return errors
  if (game.type !== 'classic') errors.push('Предметы и варианты доступны только для classic.')
  if (game.taskDistributionMode === 'random') errors.push('Для вариантов и предметов нужен линейный порядок этапов.')
  const ids = new Set()
  const stageIds = tasks.map(classicStageId)
  if (new Set(stageIds).size !== stageIds.length) errors.push('Идентификаторы этапов должны быть уникальны.')
  for (const item of items) {
    if (!item.id || ids.has(item.id) || !item.title?.trim() || !['unique', 'stackable'].includes(item.kind)) errors.push('Проверьте название, тип и уникальность ID предметов.')
    ids.add(item.id)
  }
  const quantities = (entries = [], label) => {
    if (!Array.isArray(entries)) { errors.push(`${label}: ожидается список предметов.`); return }
    const seen = new Set()
    for (const entry of entries) {
      if (!ids.has(entry.itemId) || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || seen.has(entry.itemId) ||
        (items.find((item) => item.id === entry.itemId)?.kind === 'unique' && entry.quantity !== 1)) errors.push(`${label}: неверный предмет или количество.`)
      seen.add(entry.itemId)
    }
  }
  const rewards = (content, label) => {
    for (const key of ['completed', 'timeout', 'captain_failed']) quantities(content.itemRewards?.[key], label)
    for (const reward of content.itemRewards?.codes || []) {
      const codes = reward.category === 'main' ? content.codes : reward.category === 'bonus' ? content.bonusCodes?.map((c) => c.code) : reward.category === 'penalty' ? content.penaltyCodes?.map((c) => c.code) : []
      if (!(codes || []).some((code) => normalizeClassicCode(code) === normalizeClassicCode(reward.code))) errors.push(`${label}: код награды не найден.`)
      quantities(reward.items, label)
    }
  }
  tasks.forEach((task, index) => {
    const label = `Этап ${index + 1}`
    rewards(task, label)
    for (const key of ['completed', 'timeout', 'captain_failed']) quantities(task.outcomeRewards?.[key], label)
    if (!task.variantConfig?.enabled) return
    if (!['auto', 'captain'].includes(task.variantConfig.mode)) errors.push(`${label}: выберите режим назначения.`)
    const variantIds = new Set(['default'])
    for (const variant of task.variants || []) {
      if (!variant.id || variantIds.has(variant.id) || !variant.title?.trim()) errors.push(`${label}: проверьте названия и ID вариантов.`)
      variantIds.add(variant.id)
      quantities(variant.consumeItems, label)
      if (!variant.content || typeof variant.content !== 'object') { errors.push(`${label}: отсутствует содержимое варианта.`); continue }
      const codeError = getRequiredMainCodesValidationError(variant.content)
      if (codeError) errors.push(`${label}: ${codeError}`)
      rewards(variant.content, label)
      if (!['all', 'any'].includes(variant.conditions?.mode || 'all')) errors.push(`${label}: неверный режим условий.`)
      for (const rule of variant.conditions?.rules || []) {
        if (rule.type === 'item') { quantities([{ itemId: rule.itemId, quantity: rule.quantity }], label); continue }
        if (!['code', 'outcome'].includes(rule.type)) { errors.push(`${label}: неизвестное условие.`); continue }
        const previousIndex = tasks.findIndex((task, i) => classicStageId(task, i) === rule.stageId)
        if (previousIndex < 0 || previousIndex >= index) { errors.push(`${label}: условие должно ссылаться на предыдущий этап.`); continue }
        const previous = tasks[previousIndex]
        const content = !rule.variantId || rule.variantId === 'default' ? previous : previous.variants?.find((v) => v.id === rule.variantId)?.content
        if (!content) { errors.push(`${label}: вариант в условии не найден.`); continue }
        if (rule.type === 'outcome' && !['completed', 'timeout', 'captain_failed'].includes(rule.outcome)) errors.push(`${label}: неверный исход.`)
        if (rule.type === 'code') {
          const codes = rule.category === 'main' ? content.codes : rule.category === 'bonus' ? content.bonusCodes?.map((c) => c.code) : rule.category === 'penalty' ? content.penaltyCodes?.map((c) => c.code) : []
          if (!(codes || []).some((code) => normalizeClassicCode(code) === normalizeClassicCode(rule.code))) errors.push(`${label}: код в условии не найден.`)
        }
      }
    }
  })
  return [...new Set(errors)]
}

export const validateClassicVariants = (game) => {
  try { return validateClassicVariantsUnchecked(game) }
  catch { return ['Некорректная структура вариантов, условий или предметов.'] }
}
