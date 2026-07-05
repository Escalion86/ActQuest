const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

const normalizeIdForStorage = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  const normalized =
    typeof value === 'string' ? value.trim() : String(value).trim()

  if (!normalized) {
    return null
  }

  return OBJECT_ID_RE.test(normalized) ? normalized.toLowerCase() : normalized
}

const normalizeIdsForStorage = (values) => {
  if (!Array.isArray(values)) {
    return []
  }

  return values.map(normalizeIdForStorage).filter(Boolean)
}

normalizeIdForStorage.normalizeIdsForStorage = normalizeIdsForStorage

module.exports = normalizeIdForStorage
