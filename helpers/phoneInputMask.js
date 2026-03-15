const extractDigits = (value) => String(value || '').replace(/\D/g, '')

export const formatPhoneInput = (value) => {
  const rawDigits = extractDigits(value)
  if (!rawDigits) return ''

  let localDigits = rawDigits
  if (localDigits[0] === '7' || localDigits[0] === '8') {
    localDigits = localDigits.slice(1)
  }

  localDigits = localDigits.slice(0, 10)

  let output = '+7'
  if (localDigits.length === 0) return output

  output += ` ${localDigits.slice(0, 3)}`
  if (localDigits.length > 3) output += ` ${localDigits.slice(3, 6)}`
  if (localDigits.length > 6) output += `-${localDigits.slice(6, 8)}`
  if (localDigits.length > 8) output += `-${localDigits.slice(8, 10)}`

  return output
}

export const normalizePhoneForSubmit = (value) => {
  const digits = extractDigits(value)
  if (!digits) return ''

  if (digits.length === 10) {
    return `7${digits}`
  }

  if (digits.length >= 11) {
    if (digits[0] === '8') return `7${digits.slice(1, 11)}`
    if (digits[0] === '7') return digits.slice(0, 11)
    return `7${digits.slice(0, 10)}`
  }

  if (digits[0] === '7' || digits[0] === '8') {
    return `7${digits.slice(1)}`
  }

  return `7${digits}`
}
