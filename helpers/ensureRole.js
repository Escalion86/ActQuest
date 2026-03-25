const ensureRole = (value, fallback = 'client') => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (value) {
    return String(value)
  }

  return fallback
}

export default ensureRole
