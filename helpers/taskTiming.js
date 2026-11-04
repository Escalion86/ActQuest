const secondsOr = (value, fallback) => value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : fallback

export const hasCustomTaskTiming = (game) => game?.type === 'classic' && (Array.isArray(game.clueIntervals) || (game.tasks || []).some((task) => task.taskDuration != null || Array.isArray(task.clueIntervals)))

export const getTaskDurationSeconds = (game, task) => {
  const common = secondsOr(game?.taskDuration, 3600)
  if (game?.type === 'photo' || game?.type === 'story') return common
  const own = secondsOr(task?.taskDuration, common)
  return own > 0 ? own : common
}

const getClueIntervalsSeconds = (game, task) => {
  const custom = game?.type !== 'photo' && game?.type !== 'story'
    ? task?.clueIntervals ?? game?.clueIntervals : null
  const intervals = Array.isArray(custom) ? custom : [secondsOr(game?.cluesDuration, 1200)]
  if (!intervals.length || intervals.some((value) => !Number.isSafeInteger(value) || value <= 0)) return []
  return intervals
}

// Интервалы считаются от предыдущей подсказки; последний повторяется для оставшихся.
export const getClueTimesSeconds = (game, task) => {
  const count = Array.isArray(task?.clues) ? task.clues.length : 0
  const intervals = getClueIntervalsSeconds(game, task)
  if (!intervals.length) return []
  let at = 0
  return Array.from({ length: count }, (_, index) => {
    at += intervals[Math.min(index, intervals.length - 1)]
    return at
  })
}

export const getRequiredCluesCountForTask = (game, task) => {
  const duration = getTaskDurationSeconds(game, task)
  const intervals = getClueIntervalsSeconds(game, task)
  if (duration <= 0 || !intervals.length) return 0
  let at = 0
  let count = 0
  for (const interval of intervals) {
    at += interval
    if (at >= duration) return count
    count++
  }
  return count + Math.max(0, Math.ceil((duration - at) / intervals[intervals.length - 1]) - 1)
}

export const getTaskClueCoverage = (game, task) => {
  const requiredCount = getRequiredCluesCountForTask(game, task)
  const actualCount = Array.isArray(task?.clues) ? task.clues.length : 0
  return { requiredCount, actualCount, isIncomplete: actualCount < requiredCount, allowIncomplete: task?.allowIncompleteClues === true }
}

export const getTaskClueCountError = (game, task) => {
  const coverage = getTaskClueCoverage(game, task)
  return !task?.canceled && coverage.isIncomplete && !coverage.allowIncomplete
    ? `недостаточно подсказок (${coverage.actualCount}/${coverage.requiredCount}) для заполнения времени задания.`
    : null
}

export const getTimedCluesCountForTask = (game, task, elapsed) =>
  getClueTimesSeconds(game, task).filter((at) => at <= Math.max(0, elapsed)).length

export const getTaskTimingErrors = (game) => {
  if (game?.type !== 'classic') return []
  const errors = []
  const schedule = (value, label) => {
    if (value !== null && value !== undefined && (!Array.isArray(value) || value.some((seconds) => !Number.isSafeInteger(seconds) || seconds <= 0))) errors.push(`${label}: интервалы подсказок должны быть положительными целыми секундами.`)
  }
  schedule(game.clueIntervals, 'Игра')
  for (const [index, task] of (game.tasks || []).entries()) {
    if (task.taskDuration !== null && task.taskDuration !== undefined && (!Number.isSafeInteger(task.taskDuration) || task.taskDuration <= 0)) errors.push(`Задание ${index + 1}: продолжительность должна быть положительным целым числом секунд.`)
    schedule(task.clueIntervals, `Задание ${index + 1}`)
  }
  return errors
}
