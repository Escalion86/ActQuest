import { getTaskTimeAdjustmentSeconds } from './taskTimeAdjustments.js'
import { getTaskDurationSeconds } from './taskTiming.js'

const toDateValue = (value) => {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toNonNegativeSeconds = (value, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(Math.floor(numeric), 0)
}

export const normalizeClassicCode = (value) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().toLowerCase()
    : ''

export const getConfiguredMainCodes = (task) =>
  (Array.isArray(task?.codes) ? task.codes : [])
    .map(normalizeClassicCode)
    .filter(Boolean)

export const resolveRequiredMainCodesCount = (task) => {
  const codesCount = getConfiguredMainCodes(task).length
  const rawValue = task?.numCodesToCompliteTask

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return codesCount
  }

  const numeric = Number(rawValue)
  if (
    !Number.isInteger(numeric) ||
    numeric < 1 ||
    numeric > codesCount
  ) {
    return codesCount
  }

  return numeric
}

export const getRequiredMainCodesValidationError = (task) => {
  const codesCount = getConfiguredMainCodes(task).length
  const rawValue = task?.numCodesToCompliteTask

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null
  }

  const numeric = Number(rawValue)
  if (!Number.isInteger(numeric) || numeric < 1) {
    return 'Количество кодов для выполнения должно быть целым числом не меньше 1.'
  }

  if (numeric > codesCount) {
    return `Количество кодов для выполнения (${numeric}) не может быть больше количества основных кодов (${codesCount}).`
  }

  return null
}

export const canMutateClassicGameProgress = (status) => status === 'started'

export const resolveForceClueCost = ({
  mode,
  configuredPenaltySeconds,
  secondsUntilNextClue,
}) => {
  const normalizedMode = mode === 'penalty' ? 'penalty' : 'time'
  const waitSeconds = toNonNegativeSeconds(secondsUntilNextClue)
  const fixedPenaltySeconds = toNonNegativeSeconds(configuredPenaltySeconds)

  return {
    mode: normalizedMode,
    seconds: normalizedMode === 'penalty' ? fixedPenaltySeconds : waitSeconds,
  }
}

export const getClassicTaskTimeAdjustmentSeconds = ({
  gameTeam,
  task,
  taskIndex,
  now = new Date(),
}) => {
  return getTaskTimeAdjustmentSeconds({ timeAddings: gameTeam?.timeAddings, task, taskIndex, now })
}

export const getCaptainClueTimeSecondsForTask = getClassicTaskTimeAdjustmentSeconds

export const getClassicTaskEffectiveElapsedSeconds = ({
  gameTeam,
  task,
  taskIndex,
  startTime,
  now = new Date(),
}) => {
  const startAt = toDateValue(startTime)
  if (!startAt) return 0

  const nowDate = toDateValue(now) || new Date()
  const realElapsed = Math.max(
    Math.floor((nowDate.getTime() - startAt.getTime()) / 1000),
    0,
  )

  return (
    realElapsed +
    getClassicTaskTimeAdjustmentSeconds({ gameTeam, task, taskIndex, now })
  )
}

export const getClassicTaskMutationBlockReason = ({
  game,
  gameTeam,
  task,
  taskIndex,
  now = new Date(),
}) => {
  const endTimes = Array.isArray(gameTeam?.endTime) ? gameTeam.endTime : []
  if (toDateValue(endTimes[taskIndex])) {
    return 'completed'
  }

  const taskFailures = Array.isArray(gameTeam?.taskFailures)
    ? gameTeam.taskFailures
    : []
  const hasFailure = taskFailures.some(
    (item) =>
      Number(item?.taskIndex) === taskIndex && toDateValue(item?.failedAt),
  )
  if (hasFailure) {
    return 'failed'
  }

  const startTimes = Array.isArray(gameTeam?.startTime)
    ? gameTeam.startTime
    : []
  const startAt = toDateValue(startTimes[taskIndex])
  if (!startAt) {
    return 'not_started'
  }

  const taskDurationSeconds = getTaskDurationSeconds(game, task)

  if (
    taskDurationSeconds > 0 &&
    getClassicTaskEffectiveElapsedSeconds({
      gameTeam,
      task,
      taskIndex,
      startTime: startAt,
      now,
    }) >= taskDurationSeconds
  ) {
    return 'timeout'
  }

  return null
}
