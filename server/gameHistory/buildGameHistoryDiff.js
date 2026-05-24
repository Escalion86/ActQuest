import { sanitizeGameHistoryDisplayValue } from './sanitizeGameHistoryDisplayState.js'
import formatGameHistoryLabel from './formatGameHistoryLabel.js'

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const valuesEqual = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right)

const buildEntries = ({ before, after, path = '' }) => {
  if (valuesEqual(before, after)) {
    return []
  }

  const beforeIsObject = isPlainObject(before)
  const afterIsObject = isPlainObject(after)

  if (beforeIsObject && afterIsObject) {
    const keys = []
    const seen = new Set()
    for (const key of [...Object.keys(before), ...Object.keys(after)]) {
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      keys.push(key)
    }

    return keys.flatMap((key) =>
      buildEntries({
        before: before[key],
        after: after[key],
        path: path ? `${path}.${key}` : key,
      }),
    )
  }

  return [
    {
      path,
      label: formatGameHistoryLabel(path),
      kind: 'changed',
      beforeValue: before ?? null,
      afterValue: after ?? null,
    },
  ]
}

const buildGameHistoryDiff = ({ before = null, after = null } = {}) =>
  buildEntries({
    before: sanitizeGameHistoryDisplayValue(before),
    after: sanitizeGameHistoryDisplayValue(after),
  }).filter((entry) => entry.path)

export default buildGameHistoryDiff
