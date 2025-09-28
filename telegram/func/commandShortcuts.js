const keyShortcuts = {
  gameId: 'g',
  page: 'p',
  financeType: 'f',
  startYear: 'sy',
  startMonth: 'sm',
  endYear: 'ey',
  endMonth: 'em',
  startPickerYear: 'spy',
  endPickerYear: 'epy',
}

export const encodeCommandKeys = (command) => {
  if (!command || typeof command !== 'object') return {}

  const encoded = {}

  Object.entries(command).forEach(([key, value]) => {
    if (key === 'c') return

    const shortKey = keyShortcuts[key]
    encoded[shortKey ?? key] = value
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

  return decoded
}

export default keyShortcuts
