const CODE_KIND_ORDER = ['main', 'bonus', 'penalty']

const CODE_KIND_LABELS = {
  main: 'основных',
  bonus: 'бонусных',
  penalty: 'штрафных',
}

const normalizeCodeValue = (value) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeCodeKey = (value) => normalizeCodeValue(value).toLowerCase()

const joinWithAnd = (values) => {
  if (!Array.isArray(values) || values.length === 0) {
    return ''
  }

  if (values.length === 1) {
    return values[0]
  }

  if (values.length === 2) {
    return `${values[0]} и ${values[1]}`
  }

  return `${values.slice(0, -1).join(', ')} и ${values[values.length - 1]}`
}

const toSortedKinds = (kindsSet) =>
  CODE_KIND_ORDER.filter((kind) => kindsSet.has(kind))

const getTaskCodesByKind = (task) => {
  const mainCodes = Array.isArray(task?.codes)
    ? task.codes.map((code) => ({ kind: 'main', value: code }))
    : []

  const bonusCodes = Array.isArray(task?.bonusCodes)
    ? task.bonusCodes.map((bonusCode) => ({
        kind: 'bonus',
        value: bonusCode?.code,
      }))
    : []

  const penaltyCodes = Array.isArray(task?.penaltyCodes)
    ? task.penaltyCodes.map((penaltyCode) => ({
        kind: 'penalty',
        value: penaltyCode?.code,
      }))
    : []

  return [...mainCodes, ...bonusCodes, ...penaltyCodes]
}

export const getTaskDuplicateCodeConflicts = (task) => {
  const grouped = new Map()

  getTaskCodesByKind(task).forEach(({ kind, value }) => {
    const normalizedValue = normalizeCodeValue(value)
    const key = normalizeCodeKey(normalizedValue)
    if (!key) {
      return
    }

    const current = grouped.get(key) || {
      code: normalizedValue,
      kinds: new Set(),
      totalCount: 0,
    }

    current.kinds.add(kind)
    current.totalCount += 1
    if (!current.code) {
      current.code = normalizedValue
    }

    grouped.set(key, current)
  })

  return Array.from(grouped.values())
    .filter((item) => item.totalCount > 1)
    .map((item) => ({
      code: item.code,
      totalCount: item.totalCount,
      kinds: toSortedKinds(item.kinds),
    }))
}

export const getDuplicateCodeKindsLabel = (kinds) => {
  const labels = (Array.isArray(kinds) ? kinds : [])
    .map((kind) => CODE_KIND_LABELS[kind])
    .filter(Boolean)

  if (labels.length === 0) {
    return 'кодах'
  }

  return `${joinWithAnd(labels)} кодах`
}

