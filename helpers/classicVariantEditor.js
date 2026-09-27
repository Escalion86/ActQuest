import { classicStageId, getClassicVariantChoices } from './classicVariants.js'
import { normalizeClassicCode } from './classicGameRules.js'

// Стабильные локальные ID нужны общему редактору, но не меняют игровые ссылки.
export const classicEditorContent = (content, prefix) => ({
  ...content,
  id: prefix,
  clues: (content.clues || []).map((entry, index) => ({ ...entry, id: entry.id || `${prefix}-clue-${index}` })),
  bonusCodes: (content.bonusCodes || []).map((entry, index) => ({ ...entry, id: entry.id || `${prefix}-bonus-${index}` })),
  penaltyCodes: (content.penaltyCodes || []).map((entry, index) => ({ ...entry, id: entry.id || `${prefix}-penalty-${index}` })),
})

export const copyClassicContent = (task) => {
  const { id: _id, _id: _mongoId, mongoId: _draftMongoId, stageKey: _stage, variants: _variants,
    variantConfig: _config, outcomeRewards: _outcomes, canceled: _canceled,
    isBonusTask: _bonus, publicTitle: _publicTitle, ...content } = task
  return structuredClone(content)
}

export const classicItemUsage = (tasks, itemId) => {
  const grants = new Set()
  const uses = new Set()
  const contains = (entries) => (entries || []).some((entry) => entry.itemId === itemId)
  const rewards = (value, label) => {
    if (['completed', 'timeout', 'captain_failed'].some((key) => contains(value?.[key])) || value?.codes?.some((code) => contains(code.items))) grants.add(label)
  }
  tasks.forEach((task, index) => {
    const label = `Этап ${index + 1}: ${task.title || 'Без названия'}`
    rewards(task.itemRewards, `${label}, основное задание`)
    rewards(task.outcomeRewards, `${label}, общая награда`)
    for (const variant of task.variants || []) {
      const path = `${label}, ${variant.title || 'Без названия'}`
      rewards(variant.content?.itemRewards, path)
      if (contains(variant.consumeItems) || variant.conditions?.rules?.some((rule) => rule.type === 'item' && rule.itemId === itemId)) uses.add(path)
    }
  })
  return { grants: [...grants], uses: [...uses] }
}

export const normalizeClassicItemQuantities = (value, items) => {
  const uniqueIds = new Set(items.filter((item) => item.kind === 'unique').map((item) => item.id))
  const visit = (entry) => {
    if (Array.isArray(entry)) return entry.map(visit)
    if (!entry || typeof entry !== 'object') return entry
    const result = Object.fromEntries(Object.entries(entry).map(([key, child]) => [key, visit(child)]))
    if (uniqueIds.has(result.itemId) && 'quantity' in result) result.quantity = 1
    return result
  }
  return visit(value)
}

export const describeClassicCondition = (rule, game) => {
  if (rule.type === 'item') {
    const item = game.classicItems?.find((entry) => entry.id === rule.itemId)
    if (item?.kind === 'unique') return `${rule.absent ? 'Нет предмета' : 'Есть предмет'} «${item.title}»`
    return `${rule.absent ? 'Меньше' : 'Не меньше'} ${rule.quantity || 1} × ${item?.title || 'предмет не выбран'}`
  }
  const index = game.tasks.findIndex((task, i) => classicStageId(task, i) === rule.stageId)
  const task = game.tasks[index]
  const variantTitle = rule.variantId === 'default' ? 'основной вариант' : task?.variants?.find((variant) => variant.id === rule.variantId)?.title
  const source = `Этап ${index + 1}${variantTitle ? `, ${variantTitle}` : ''}`
  if (rule.type === 'code') return `${source}: код «${rule.code || 'не выбран'}» ${rule.absent ? 'не введён' : 'введён'}`
  return `${source}: ${{ completed: 'выполнен', timeout: 'время истекло', captain_failed: 'слит капитаном' }[rule.outcome] || 'исход не выбран'}`
}

export const explainClassicVariant = (game, team, index, variant) => {
  const task = game.tasks[index]
  const rules = variant.conditions?.rules || []
  const failed = rules.filter((rule) => !getClassicVariantChoices({ ...game, tasks: game.tasks.map((entry, i) => i !== index ? entry : {
    ...task, variantConfig: { enabled: true, mode: 'auto' },
    variants: [{ ...variant, conditions: { mode: 'all', rules: [rule] }, consumeItems: [] }],
  }) }, team, index).some((entry) => entry.id === variant.id))
  const reasons = (variant.conditions?.mode === 'any' && failed.length < rules.length) ? [] : failed.map((rule) => `Не выполнено: ${describeClassicCondition(rule, game)}`)
  for (const cost of variant.consumeItems || []) {
    const quantity = team.classicProgress?.inventory?.find((entry) => entry.itemId === cost.itemId)?.quantity || 0
    if (quantity < cost.quantity) reasons.push(`Для расхода нужен ${game.classicItems?.find((item) => item.id === cost.itemId)?.title || 'предмет'} ×${cost.quantity}, у команды ${quantity}`)
  }
  return reasons
}

export const updateClassicEditorContent = (game, taskId, variantId, update) => ({
  ...game,
  tasks: game.tasks.map((task) => {
    if (task.id !== taskId) return task
    if (variantId === 'default') return { ...task, ...update(task) }
    return { ...task, variants: (task.variants || []).map((variant) => {
      if (variant.id !== variantId) return variant
      const content = classicEditorContent(variant.content || {}, variant.id)
      const { id: _id, ...next } = { ...content, ...update(content) }
      return { ...variant, content: next }
    }) }
  }),
})

// При переименовании кода его награда и ссылки условий должны следовать за ним.
export const changeClassicEditorCode = (game, taskId, variantId, category, key, value, remove = false) => {
  const index = game.tasks.findIndex((task) => task.id === taskId)
  if (index < 0) return game
  const stage = game.tasks[index]
  const source = variantId === 'default' ? stage : stage.variants?.find((variant) => variant.id === variantId)?.content
  if (!source) return game
  const field = category === 'main' ? 'codes' : `${category}Codes`
  const content = classicEditorContent(source, variantId)
  const oldCode = category === 'main' ? content.codes?.[key] : content[field]?.find((entry) => entry.id === key)?.code
  const next = updateClassicEditorContent(game, taskId, variantId, (current) => {
    const entries = current[field] || []
    const matches = (entry, i) => category === 'main' ? i === key : entry.id === key
    const patch = { [field]: remove ? entries.filter((entry, i) => !matches(entry, i)) : entries.map((entry, i) => matches(entry, i) ? category === 'main' ? value : { ...entry, code: value } : entry) }
    if (remove && category === 'main') patch.codePhotos = (current.codePhotos || []).filter((_, i) => i !== key)
    if (current.itemRewards?.codes && oldCode !== undefined) patch.itemRewards = {
      ...current.itemRewards,
      codes: current.itemRewards.codes.flatMap((reward) => reward.category === category && normalizeClassicCode(reward.code) === normalizeClassicCode(oldCode)
        ? remove ? [] : [{ ...reward, code: value }] : [reward]),
    }
    return patch
  })
  // Удалённые коды в условиях оставляем для явной ошибки валидации.
  if (remove || oldCode === undefined) return next
  return { ...next, tasks: next.tasks.map((task) => ({ ...task, variants: task.variants?.map((variant) => ({
    ...variant,
    conditions: variant.conditions ? { ...variant.conditions, rules: (variant.conditions.rules || []).map((rule) =>
      rule.type === 'code' && rule.stageId === classicStageId(stage, index) && rule.variantId === variantId && rule.category === category && normalizeClassicCode(rule.code) === normalizeClassicCode(oldCode)
        ? { ...rule, code: value } : rule) } : variant.conditions,
  })) })) }
}
