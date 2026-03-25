const extractErrorMessage = (value, fallbackMessage = null) => {
  if (!value) {
    return fallbackMessage
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : fallbackMessage
  }

  if (typeof value?.message === 'string') {
    const normalized = value.message.trim()
    if (normalized.length > 0) {
      return normalized
    }
  }

  if (typeof value?.error === 'string') {
    const normalized = value.error.trim()
    if (normalized.length > 0) {
      return normalized
    }
  }

  return fallbackMessage
}

export default extractErrorMessage
