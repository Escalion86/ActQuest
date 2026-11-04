// Корректировки игрового времени задания уже входят в его зачётную длительность.
export const isTaskTimeAdjustment = (adding) =>
  adding?.scope === 'task_elapsed' ||
  adding?.source === 'captain_force_clue' ||
  (typeof adding?.name === 'string' && adding.name.startsWith('Досрочная подсказка'))

export const isTimeAddingForTask = (adding, taskIndex, task) => {
  const ids = [task?._id, task?.stageKey, task?.id]
    .filter((id) => id !== null && id !== undefined)
    .map(String)
  if (adding?.taskId && ids.length) return ids.includes(String(adding.taskId))
  return adding?.taskIndex !== null && adding?.taskIndex !== undefined &&
    Number.isInteger(Number(adding.taskIndex)) && Number(adding.taskIndex) === taskIndex
}

export const getTimeAddingSeconds = (adding, now = new Date()) => {
  const seconds = Number(adding?.time)
  if (!Number.isFinite(seconds)) return 0
  if (adding.source !== 'item_time_freeze') return Math.round(seconds)
  const started = new Date(adding.createdAt).getTime()
  if (!Number.isFinite(started)) return 0
  return -Math.min(Math.abs(seconds), Math.max(0, Math.floor((new Date(now).getTime() - started) / 1000)))
}

export const getActiveTaskFreeze = ({ timeAddings, taskIndex, task, now = new Date() }) =>
  (timeAddings || []).find((adding) => adding.source === 'item_time_freeze' && isTimeAddingForTask(adding, taskIndex, task) && new Date(adding.createdAt).getTime() + Math.abs(Number(adding.time) || 0) * 1000 > new Date(now).getTime()) || null

export const getTaskTimeAdjustmentSeconds = ({ timeAddings, taskIndex, task, now = new Date() }) =>
  (Array.isArray(timeAddings) ? timeAddings : []).reduce((sum, adding) => {
    if (!isTaskTimeAdjustment(adding) || !isTimeAddingForTask(adding, taskIndex, task)) return sum
    return sum + getTimeAddingSeconds(adding, now)
  }, 0)
