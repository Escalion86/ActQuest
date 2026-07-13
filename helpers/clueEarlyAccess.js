export const getTimedCluesCount = (taskDuration, cluesDuration) => {
  const normalizedTaskDuration = Number(taskDuration)
  const normalizedCluesDuration = Number(cluesDuration)

  if (
    !Number.isFinite(normalizedTaskDuration) ||
    !Number.isFinite(normalizedCluesDuration) ||
    normalizedTaskDuration <= 0 ||
    normalizedCluesDuration <= 0 ||
    normalizedCluesDuration >= normalizedTaskDuration
  ) {
    return 0
  }

  return Math.ceil(
    (normalizedTaskDuration - normalizedCluesDuration) /
      normalizedCluesDuration,
  )
}

export const normalizeClueEarlyAccessFrom = (value, fallback = 1) => {
  const normalizedValue = Number(value)

  if (!Number.isInteger(normalizedValue) || normalizedValue < 1) {
    return fallback
  }

  return normalizedValue
}
