const keyShortcuts = {
  gameId: 'g',
  gameTeamId: 'gt',
  page: 'p',
  toggle: 't',
  financeType: 'f',
  startYear: 'sy',
  startMonth: 'sm',
  endYear: 'ey',
  endMonth: 'em',
  startPickerYear: 'spy',
  endPickerYear: 'epy',
  forceClue: 'fc',
  failTask: 'ft',
  finishBreak: 'fb',
  confirmFinishBreak: 'cfb',
  confirmForceClue: 'cfc',
  confirmFailTask: 'cft',
}

const yearKeys = new Set([
  'startYear',
  'endYear',
  'startPickerYear',
  'endPickerYear',
])

const YEAR_OFFSET = 1900

export const encodeCommandKeys = (command) => {
  if (!command || typeof command !== 'object') return {}

  const encoded = {}

  Object.entries(command).forEach(([key, value]) => {
    if (key === 'c') return

    const shortKey = keyShortcuts[key]
    let encodedValue = value

    if (yearKeys.has(key) && typeof value === 'number') {
      encodedValue = value - YEAR_OFFSET
    }

    encoded[shortKey ?? key] = encodedValue
  })

  return encoded
}

export const decodeCommandKeys = (command) => {
  if (!command || typeof command !== 'object') return command

  const decoded = { ...command }

  Object.entries(keyShortcuts).forEach(([key, shortKey]) => {
    if (decoded[shortKey] !== undefined && decoded[key] === undefined) {
      decoded[key] = decoded[shortKey]
      delete decoded[shortKey]
    }
  })

  Object.entries(decoded).forEach(([key, value]) => {
    if (yearKeys.has(key) && typeof value === 'number') {
      decoded[key] = value + YEAR_OFFSET
    }
  })

  return decoded
}

export default keyShortcuts
