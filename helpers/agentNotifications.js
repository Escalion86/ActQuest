import {
  getTaskFailureEntry,
  hasTeamFinishedAgentWorkForTask,
  isTaskBreakActive,
} from './agentGameStatus.js'

const ensureArray = (value) => (Array.isArray(value) ? value : [])

const getTaskAgentIds = (task) =>
  (Array.isArray(task?.agentUserIds) ? task.agentUserIds : [])
    .map((value) => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'string') return value.trim()
      if (typeof value?.toString === 'function') {
        const nextValue = value.toString()
        return nextValue === '[object Object]' ? '' : nextValue.trim()
      }
      return ''
    })
    .filter(Boolean)

const getAgentNotificationSettings = (game) => ({
  onPreviousTask: game?.agentNotifications?.onPreviousTask !== false,
  onCurrentTask: game?.agentNotifications?.onCurrentTask !== false,
  onTaskCompleted: game?.agentNotifications?.onTaskCompleted === true,
  onAllTeamsPassed: game?.agentNotifications?.onAllTeamsPassed !== false,
})

const resolveTaskEventsForTeam = ({ game, gameTeam, now = new Date() }) => {
  const settings = getAgentNotificationSettings(game)
  const tasks = ensureArray(game?.tasks)
  const tasksCount = tasks.length
  const activeTaskIndex = Number.isInteger(gameTeam?.activeNum)
    ? gameTeam.activeNum
    : Number(gameTeam?.activeNum) || 0
  const startTime = ensureArray(gameTeam?.startTime)
  const endTime = ensureArray(gameTeam?.endTime)
  const breakDurationSeconds = Number(game?.breakDuration) || 0
  const taskDurationSeconds = Number(game?.taskDuration) || 3600
  const isBreakActiveOnCurrentTask = isTaskBreakActive({
    gameTeam,
    taskIndex: activeTaskIndex,
    breakDurationSeconds,
    taskDurationSeconds,
    now,
  })
  const events = []

  tasks.forEach((task, taskIndex) => {
    const agentUserIds = getTaskAgentIds(task)
    if (agentUserIds.length === 0) return

    if (
      settings.onPreviousTask &&
      activeTaskIndex + 1 === taskIndex &&
      Boolean(startTime[activeTaskIndex])
    ) {
      events.push({ eventType: 'previous_task', taskIndex, agentUserIds })
    }

    if (
      settings.onCurrentTask &&
      activeTaskIndex === taskIndex &&
      Boolean(startTime[taskIndex]) &&
      !Boolean(endTime[taskIndex]) &&
      !isBreakActiveOnCurrentTask
    ) {
      events.push({ eventType: 'current_task', taskIndex, agentUserIds })
    }

    if (
      settings.onTaskCompleted &&
      hasTeamFinishedAgentWorkForTask({
        gameTeam,
        taskIndex,
        tasksCount,
        breakDurationSeconds,
        taskDurationSeconds,
        now,
      })
    ) {
      events.push({ eventType: 'task_completed', taskIndex, agentUserIds })
    }
  })

  return events
}

export {
  getAgentNotificationSettings,
  getTaskAgentIds,
  getTaskFailureEntry,
  resolveTaskEventsForTeam,
}
