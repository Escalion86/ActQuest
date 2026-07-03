const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

const normalizeIdForStorage = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  const normalized =
    typeof value === 'string' ? value.trim() : String(value).trim()

  if (!normalized) {
    return ''
  }

  return OBJECT_ID_RE.test(normalized) ? normalized.toLowerCase() : normalized
}

module.exports = normalizeIdForStorage
