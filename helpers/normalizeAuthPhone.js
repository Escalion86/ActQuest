const normalizeAuthPhone = (value) => {
  if (value === null || typeof value === 'undefined') return null

  const raw = String(value).trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11 || !digits.startsWith('7')) {
    return null
  }

  const asNumber = Number(digits)
  return Number.isFinite(asNumber) ? asNumber : null
}

export default normalizeAuthPhone
