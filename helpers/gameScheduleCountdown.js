export const resolveGameScheduleCountdown = (game, now = Date.now()) => {
  const isBeforeStart = game?.status === 'active'
  if (!isBeforeStart && game?.status !== 'started') return null
  const dateValue = isBeforeStart ? game?.dateStart : game?.dateEnd
  if (!dateValue) return null
  const target = new Date(dateValue).getTime()
  if (!Number.isFinite(target)) return null
  return {
    label: isBeforeStart ? 'До начала игры' : 'До конца игры',
    target,
    seconds: Math.max(Math.ceil((target - now) / 1000), 0),
  }
}

export const formatScheduleCountdown = (seconds) => {
  const value = Number.isFinite(seconds) ? Math.max(Math.floor(seconds), 0) : 0
  return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}
