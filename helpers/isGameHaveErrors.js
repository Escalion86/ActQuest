import {
  getDuplicateCodeKindsLabel,
  getTaskDuplicateCodeConflicts,
} from './getTaskDuplicateCodeConflicts'

const stripHtmlToPlainText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r?\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const hasMeaningfulRichMarkup = (value) => {
  const rich = String(value || '')
  if (!rich.trim()) {
    return false
  }

  if (
    /<(img|video|audio|iframe|figure|svg|table|code|pre|blockquote|ul|ol|li|h[1-6])\b/i.test(
      rich,
    )
  ) {
    return true
  }

  // TipTap кастомные node-рендеры (аудио/видео/изображения и т.п.)
  if (
    /\b(node-image|node-video|node-audio|node-audio-message|node-audioMessage|react-renderer)\b/i.test(
      rich,
    )
  ) {
    return true
  }

  return false
}

const hasMediaItems = (value) =>
  Array.isArray(value) &&
  value.some((item) => {
    if (!item || typeof item !== 'object') {
      return false
    }
    const type = typeof item.type === 'string' ? item.type.trim() : ''
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    const path = typeof item.path === 'string' ? item.path.trim() : ''
    return Boolean(type && (url || path))
  })

const isTaskDescriptionFilled = (task) => {
  const plain = typeof task?.task === 'string' ? task.task.trim() : ''
  if (plain) {
    return true
  }

  const rich = typeof task?.taskRich === 'string' ? task.taskRich.trim() : ''
  if (stripHtmlToPlainText(rich)) {
    return true
  }

  if (hasMeaningfulRichMarkup(rich)) {
    return true
  }

  return hasMediaItems(task?.taskMedia)
}

const getEmptyCodePositions = (codes) =>
  (Array.isArray(codes) ? codes : []).reduce((positions, code, index) => {
    if (typeof code !== 'string' || code.trim() === '') {
      positions.push(index + 1)
    }
    return positions
  }, [])

export const getGameValidationErrors = (game) => {
  const errors = []
  const safeGame = game && typeof game === 'object' ? game : {}
  const taskDuration = Number(safeGame.taskDuration ?? 3600) || 3600
  const cluesDuration = Number(safeGame.cluesDuration ?? 1200) || 0
  const cluesNeeded =
    cluesDuration > 0 ? Math.ceil((taskDuration - cluesDuration) / cluesDuration) : 0
  const activeTasks = Array.isArray(safeGame.tasks)
    ? safeGame.tasks.filter((task) => !task?.canceled)
    : []

  if (taskDuration - cluesDuration < 0) {
    errors.push('Время до подсказки больше, чем длительность задания.')
  }

  if (!safeGame.startingPlace) {
    errors.push('Не указано время и место сбора.')
  }

  if (!safeGame.finishingPlace) {
    errors.push('Не указано место сбора после игры.')
  }

  if (activeTasks.length === 0) {
    errors.push('Добавьте хотя бы одно активное задание.')
    return errors
  }

  activeTasks.forEach((task, index) => {
    const taskLabel = `Задание ${index + 1}`

    if (!task?.title) {
      errors.push(`${taskLabel}: не указано название.`)
    }

    if (!isTaskDescriptionFilled(task)) {
      errors.push(`${taskLabel}: не заполнено описание задания.`)
    }

    if (safeGame.type !== 'photo') {
      const rawTaskCodes = Array.isArray(task?.codes) ? task.codes : []
      const taskCodes = rawTaskCodes.filter(
        (code) => typeof code === 'string' && code.trim() !== '',
      )
      const taskCodesLength = taskCodes.length
      const neededCodesLength = Number(task?.numCodesToCompliteTask || 0)
      const emptyCodePositions = getEmptyCodePositions(rawTaskCodes)

      if (!taskCodesLength) {
        errors.push(`${taskLabel}: не добавлен ни один код.`)
      }

      if (emptyCodePositions.length > 0) {
        errors.push(
          `${taskLabel}: заполните пустые основные коды №${emptyCodePositions.join(', ')}.`,
        )
      }

      if (taskCodesLength < neededCodesLength) {
        errors.push(
          `${taskLabel}: кодов меньше, чем требуется для выполнения (${taskCodesLength}/${neededCodesLength}).`
        )
      }
    }

    const duplicateCodeConflicts = getTaskDuplicateCodeConflicts(task)
    duplicateCodeConflicts.forEach((conflict) => {
      errors.push(
        `${taskLabel}: код «${conflict.code}» дублируется в ${getDuplicateCodeKindsLabel(conflict.kinds)}.`
      )
    })

    if (cluesDuration > 0) {
      const cluesCount = Array.isArray(task?.clues) ? task.clues.length : 0
      if (cluesCount < cluesNeeded) {
        errors.push(
          `${taskLabel}: недостаточно подсказок (${cluesCount}/${cluesNeeded}).`
        )
      }
    }
  })

  return errors
}

const isGameHaveErrors = (game) => getGameValidationErrors(game).length > 0

export default isGameHaveErrors
