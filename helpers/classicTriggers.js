import { normalizeClassicCode } from './classicGameRules.js'

export const getClassicTriggerCodes = (game, code) =>
  (game.classicTriggers || []).filter((trigger) =>
    code && trigger.source === 'code' && normalizeClassicCode(trigger.code) === code,
  )

export const getClassicItemTriggers = (game, source, itemId) =>
  (game.classicTriggers || []).filter((trigger) =>
    trigger.source === source && trigger.itemId === itemId,
  )

export const isClassicTriggerActive = (progress, id) =>
  progress?.activeTriggerIds?.includes(id) === true

export const activateClassicTriggers = (progress, triggers) => {
  const newlyActivated = triggers.filter(({ id }) => !isClassicTriggerActive(progress, id))
  if (!newlyActivated.length) return false
  progress.activeTriggerIds = [...(progress.activeTriggerIds || []), ...newlyActivated.map(({ id }) => id)]
  return true
}

export const getVisibleClassicTriggerBlocks = (task, progress) =>
  (task?.triggerBlocks || []).filter(({ triggerId }) => isClassicTriggerActive(progress, triggerId))

export const classicTaskUsesTrigger = (task, triggerId) =>
  task.triggerBlocks?.some((block) => block.triggerId === triggerId) ||
  task.variants?.some(({ content }) => content?.triggerBlocks?.some((block) => block.triggerId === triggerId))

export const validateClassicTriggers = (game) => {
  const errors = []
  const triggers = game.classicTriggers || []
  if (!Array.isArray(triggers)) return ['Ожидается список триггеров игры.']
  const items = game.classicItems || []
  const ids = new Set()
  for (const trigger of triggers) {
    if (typeof trigger?.id !== 'string' || !trigger.id.trim() || ids.has(trigger.id) || typeof trigger.title !== 'string' || !trigger.title.trim()) {
      errors.push('Проверьте названия и уникальность ID триггеров.')
      continue
    }
    ids.add(trigger.id)
    const label = `Триггер «${trigger.title}»`
    if (trigger.source === 'code') {
      if (!normalizeClassicCode(trigger.code)) errors.push(`${label}: задайте код активации.`)
    } else if (['item_granted', 'item_used'].includes(trigger.source)) {
      const item = items.find(({ id }) => id === trigger.itemId)
      if (!item) errors.push(`${label}: выберите предмет из каталога.`)
      else if (trigger.source === 'item_used' && !item.effect) errors.push(`${label}: задайте предмету активный эффект.`)
    } else {
      errors.push(`${label}: выберите способ активации.`)
    }
  }
  for (const item of items) {
    if (item.effect?.type === 'reveal_trigger' && !getClassicItemTriggers(game, 'item_used', item.id).length) {
      errors.push(`Предмет «${item.title}»: привяжите триггер на применение.`)
    }
  }
  const validateBlocks = (content, label) => {
    if (content?.triggerBlocks == null) return
    if (!Array.isArray(content.triggerBlocks)) {
      errors.push(`${label}: ожидается список скрытых блоков.`)
      return
    }
    const blockIds = new Set()
    for (const block of content.triggerBlocks) {
      if (!block?.id || blockIds.has(block.id) || !ids.has(block.triggerId)) {
        errors.push(`${label}: у каждого скрытого блока должен быть свой ID и триггер из каталога.`)
      }
      const html = typeof block?.contentRich === 'string' ? block.contentRich : ''
      if (!html.replace(/<[^>]*>|&nbsp;|&#160;/gi, '').trim() && !/<(?:img|audio|video|iframe|audio-message|video-message)\b/i.test(html)) {
        errors.push(`${label}: заполните содержимое скрытого блока.`)
      }
      blockIds.add(block?.id)
    }
  }
  for (const [index, task] of (game.tasks || []).entries()) {
    const label = `Задание ${index + 1}`
    validateBlocks(task, label)
    for (const variant of task.variants || []) validateBlocks(variant.content, `${label}, вариант «${variant.title}»`)
  }
  return errors
}
