import getSecondsBetween from './getSecondsBetween.js'

const ensureArray = (value) => (Array.isArray(value) ? value : [])

const ensureDateValue = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizeTaskFailures = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          const taskIndex = Number(item?.taskIndex)
          const failedAt = ensureDateValue(item?.failedAt)
          if (!Number.isInteger(taskIndex) || taskIndex < 0 || !failedAt) {
            return null
          }
          return {
            taskIndex,
            failedAt,
          }
        })
        .filter(Boolean)
    : []

const getTaskFailureEntry = (gameTeam, taskIndex) =>
  normalizeTaskFailures(gameTeam?.taskFailures).find(
    (item) => item.taskIndex === taskIndex,
  ) || null

const isTaskBreakActive = ({
  gameTeam,
  taskIndex,
  breakDurationSeconds,
  taskDurationSeconds,
  now = new Date(),
}) => {
  if (!Number.isInteger(taskIndex) || taskIndex < 0 || breakDurationSeconds <= 0) {
    return false
  }

  const nowDate = ensureDateValue(now) || new Date()
  const nowMs = nowDate.getTime()
  const startTime = ensureDateValue(ensureArray(gameTeam?.startTime)[taskIndex])
  const endTime = ensureDateValue(ensureArray(gameTeam?.endTime)[taskIndex])
  const failure = getTaskFailureEntry(gameTeam, taskIndex)

  if (failure?.failedAt) {
    const elapsedAfterFailure = Math.max(
      Math.floor((nowMs - failure.failedAt.getTime()) / 1000),
      0,
    )
    return elapsedAfterFailure < breakDurationSeconds
  }

  if (endTime) {
    const elapsedAfterEnd = Math.max(
      Math.floor((nowMs - endTime.getTime()) / 1000),
      0,
    )
    return elapsedAfterEnd < breakDurationSeconds
  }

  if (startTime && taskDurationSeconds > 0) {
    const elapsedSinceStart = Math.max(
      Math.floor((nowMs - startTime.getTime()) / 1000),
      0,
    )
    return (
      elapsedSinceStart >= taskDurationSeconds &&
      elapsedSinceStart < taskDurationSeconds + breakDurationSeconds
    )
  }

  return false
}

const hasTeamFinishedAgentWorkForTask = ({
  gameTeam,
  taskIndex,
  tasksCount,
  breakDurationSeconds,
  taskDurationSeconds,
  now = new Date(),
}) => {
  const activeNum = Number.isInteger(gameTeam?.activeNum)
    ? gameTeam.activeNum
    : Number(gameTeam?.activeNum) || 0
  const endTime = ensureArray(gameTeam?.endTime)

  if (tasksCount > 0 && activeNum >= tasksCount) {
    return true
  }

  if (activeNum > taskIndex || Boolean(endTime[taskIndex])) {
    return true
  }

  if (getTaskFailureEntry(gameTeam, taskIndex)) {
    return true
  }

  return isTaskBreakActive({
    gameTeam,
    taskIndex,
    breakDurationSeconds,
    taskDurationSeconds,
    now,
  })
}

const resolveTeamBreakState = ({
  gameTeam,
  tasksCount,
  breakDurationSeconds,
  taskDurationSeconds,
  now = new Date(),
}) => {
  const activeTaskIndex = Number.isInteger(gameTeam?.activeNum)
    ? gameTeam.activeNum
    : Number(gameTeam?.activeNum) || 0

  if (
    !Number.isInteger(activeTaskIndex) ||
    activeTaskIndex < 0 ||
    activeTaskIndex >= tasksCount
  ) {
    return {
      isTeamOnBreak: false,
      breakTimeLeftSeconds: 0,
    }
  }

  const isTeamOnBreak = isTaskBreakActive({
    gameTeam,
    taskIndex: activeTaskIndex,
    breakDurationSeconds,
    taskDurationSeconds,
    now,
  })

  if (!isTeamOnBreak) {
    return {
      isTeamOnBreak: false,
      breakTimeLeftSeconds: 0,
    }
  }

  const nowDate = ensureDateValue(now) || new Date()
  const startTime = ensureDateValue(ensureArray(gameTeam?.startTime)[activeTaskIndex])
  const endTime = ensureDateValue(ensureArray(gameTeam?.endTime)[activeTaskIndex])
  const failure = getTaskFailureEntry(gameTeam, activeTaskIndex)
  let breakStartedAt = failure?.failedAt || endTime || null

  if (!breakStartedAt && startTime && taskDurationSeconds > 0) {
    breakStartedAt = new Date(
      startTime.getTime() + taskDurationSeconds * 1000,
    )
  }

  if (!breakStartedAt) {
    return {
      isTeamOnBreak: false,
      breakTimeLeftSeconds: 0,
    }
  }

  return {
    isTeamOnBreak: true,
    breakTimeLeftSeconds: Math.max(
      0,
      breakDurationSeconds - getSecondsBetween(breakStartedAt, nowDate),
    ),
  }
}

const resolveTeamAgentStatus = ({
  gameTeam,
  assignedTaskIndexes,
  tasksCount,
  breakDurationSeconds,
  taskDurationSeconds,
  now = new Date(),
}) => {
  const activeTaskIndex = Number.isInteger(gameTeam?.activeNum)
    ? gameTeam.activeNum
    : Number(gameTeam?.activeNum) || 0
  const startTime = ensureArray(gameTeam?.startTime)
  const endTime = ensureArray(gameTeam?.endTime)
  const isFinished = tasksCount > 0 && activeTaskIndex >= tasksCount
  const isBreakActiveOnCurrentTask = isTaskBreakActive({
    gameTeam,
    taskIndex: activeTaskIndex,
    breakDurationSeconds,
    taskDurationSeconds,
    now,
  })

  const activeAssignedTaskIndex = assignedTaskIndexes.find(
    (taskIndex) =>
      activeTaskIndex === taskIndex &&
      Boolean(startTime[taskIndex]) &&
      !Boolean(endTime[taskIndex]) &&
      !isBreakActiveOnCurrentTask,
  )
  if (Number.isInteger(activeAssignedTaskIndex)) {
    return {
      status: 'active',
      taskIndex: activeAssignedTaskIndex,
      currentTaskSeconds: getSecondsBetween(
        startTime[activeAssignedTaskIndex],
        now,
      ),
    }
  }

  const approachingTaskIndex = assignedTaskIndexes.find(
    (taskIndex) =>
      activeTaskIndex + 1 === taskIndex &&
      Boolean(startTime[activeTaskIndex]) &&
      !isFinished,
  )
  if (Number.isInteger(approachingTaskIndex)) {
    return {
      status: 'approaching',
      taskIndex: approachingTaskIndex,
      currentTaskSeconds: startTime[activeTaskIndex]
        ? getSecondsBetween(startTime[activeTaskIndex], now)
        : 0,
    }
  }

  const hasUnfinishedAssignedTask = assignedTaskIndexes.some(
    (taskIndex) =>
      !hasTeamFinishedAgentWorkForTask({
        gameTeam,
        taskIndex,
        tasksCount,
        breakDurationSeconds,
        taskDurationSeconds,
        now,
      }),
  )

  if (!hasUnfinishedAssignedTask || isFinished) {
    return {
      status: isFinished ? 'finished' : 'passed',
      taskIndex: assignedTaskIndexes[assignedTaskIndexes.length - 1] ?? null,
      currentTaskSeconds: 0,
    }
  }

  return {
    status: 'waiting',
    taskIndex:
      assignedTaskIndexes.find(
        (taskIndex) =>
          !hasTeamFinishedAgentWorkForTask({
            gameTeam,
            taskIndex,
            tasksCount,
            breakDurationSeconds,
            taskDurationSeconds,
            now,
          }),
      ) ?? null,
    currentTaskSeconds: startTime[activeTaskIndex]
      ? getSecondsBetween(startTime[activeTaskIndex], now)
      : 0,
  }
}

export {
  getTaskFailureEntry,
  hasTeamFinishedAgentWorkForTask,
  isTaskBreakActive,
  resolveTeamBreakState,
  resolveTeamAgentStatus,
}
