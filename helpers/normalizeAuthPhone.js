const normalizeAuthPhone = (value) => {
  if (value === null || typeof value === 'undefined') return null

  const raw = String(value).trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  let normalizedDigits = digits
  if (normalizedDigits.length === 10) {
    normalizedDigits = `7${normalizedDigits}`
  } else if (normalizedDigits.length === 11 && normalizedDigits.startsWith('8')) {
    normalizedDigits = `7${normalizedDigits.slice(1)}`
  }

  if (normalizedDigits.length !== 11 || !normalizedDigits.startsWith('7')) {
    return null
  }

  const asNumber = Number(normalizedDigits)
  return Number.isFinite(asNumber) ? asNumber : null
}

export default normalizeAuthPhone
