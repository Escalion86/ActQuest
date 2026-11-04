export const CLASSIC_ITEM_EFFECTS = [
  { type: 'time_rewind', title: 'Телепорт во времени', description: 'Уменьшает игровое и зачётное время задания. Будущие подсказки сдвигаются, открытые сохраняются.', seconds: 300 },
  { type: 'time_freeze', title: 'Песочные часы', description: 'Приостанавливает часы задания и будущие подсказки. В результат идёт только фактически использованное время заморозки.', seconds: 120 },
  { type: 'free_clue', title: 'Хрустальный шар', description: 'Открывает следующую обычную подсказку без штрафа и перевода времени.' },
  { type: 'secret_clue', title: 'Тайное послание', description: 'Открывает подготовленную организатором дополнительную подсказку.' },
  { type: 'penalty_shield', title: 'Щит', description: 'Нейтрализует следующий штраф за штрафной код или подбор на текущем задании. Не отменяет провал задания и платные подсказки.' },
  { type: 'penalty_erase', title: 'Ластик', description: 'Снимает один выбранный штраф за код или подбор текущего задания. История вводов сохраняется.' },
  { type: 'lockpick', title: 'Отмычка', description: 'Закрывает один недостающий обязательный код. Награда за ввод настоящего кода не выдаётся.' },
  { type: 'compass', title: 'Компас', description: 'Показывает подготовленный организатором ориентир: текст и изображение для поиска.' },
  { type: 'portal', title: 'Портал', description: 'Завершает текущее задание без решения и штрафа за провал. Начинается обычный перерыв.' },
]

export const getClassicEffectDefinition = (type) => CLASSIC_ITEM_EFFECTS.find((entry) => entry.type === type)
export const isClassicHelpEffect = (type) => type === 'secret_clue' || type === 'compass'
export const isClassicTimedEffect = (type) => type === 'time_rewind' || type === 'time_freeze'
export const getClassicEffectLabel = (effect) => {
  const title = getClassicEffectDefinition(effect?.type)?.title || 'Без активного эффекта'
  return isClassicTimedEffect(effect?.type) ? `${title}: ${effect.type === 'time_rewind' ? '−' : ''}${effect.seconds / 60} мин.` : title
}
export const getClassicEffectValidationError = (effect) => {
  if (!effect) return null
  if (!getClassicEffectDefinition(effect.type)) return 'Неизвестный эффект предмета.'
  if (isClassicTimedEffect(effect.type) && (!Number.isSafeInteger(effect.seconds) || effect.seconds <= 0)) return 'Задайте положительную целую длительность эффекта в секундах.'
  if (effect.allowedStageIds !== undefined && (!Array.isArray(effect.allowedStageIds) || effect.allowedStageIds.some((id) => typeof id !== 'string'))) return 'Проверьте задания для применения предмета.'
  if (isClassicHelpEffect(effect.type)) {
    if (typeof effect.text !== 'string' && effect.text != null) return 'Текст подсказки должен быть строкой.'
    if (typeof effect.image !== 'string' && effect.image != null) return 'Ссылка на изображение должна быть строкой.'
    if (!effect.text?.trim() && !effect.image) return 'Заполните текст или изображение для команды.'
    if (effect.image) {
      try { if (!['http:', 'https:'].includes(new URL(effect.image).protocol)) return 'Укажите ссылку на изображение по HTTP или HTTPS.' }
      catch { return 'Укажите корректную ссылку на изображение.' }
    }
  }
  return null
}

// Содержимое скрытой помощи выдаётся только после успешного применения.
export const getPublicClassicEffect = (effect) => effect ? { type: effect.type, ...(isClassicTimedEffect(effect.type) ? { seconds: effect.seconds } : {}) } : null
