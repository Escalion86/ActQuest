const OMITTED_DISPLAY_KEYS = new Set(['_id', 'createdAt', 'updatedAt'])

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const sanitizeGameHistoryDisplayValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeGameHistoryDisplayValue(item))
      .filter((item) => item !== undefined)
  }

  if (!isPlainObject(value)) {
    return value
  }

  const nextObject = Object.keys(value).reduce((acc, key) => {
    if (OMITTED_DISPLAY_KEYS.has(key)) {
      return acc
    }

    const sanitizedChild = sanitizeGameHistoryDisplayValue(value[key])
    if (sanitizedChild !== undefined) {
      acc[key] = sanitizedChild
    }
    return acc
  }, {})

  return Object.keys(nextObject).length > 0 ? nextObject : undefined
}

const sanitizeGameHistoryDisplayState = (state) => {
  if (!state || typeof state !== 'object') {
    return { game: null, gameTeams: [] }
  }

  return {
    game: state.game ? sanitizeGameHistoryDisplayValue(state.game) ?? null : null,
    gameTeams: Array.isArray(state.gameTeams)
      ? state.gameTeams
          .map((entry) => sanitizeGameHistoryDisplayValue(entry))
          .filter((entry) => entry !== undefined)
      : [],
  }
}

export default sanitizeGameHistoryDisplayState
