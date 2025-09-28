export const newline = '\n'
export const doubleNewline = `${newline}${newline}`

const isNonEmpty = (value) => {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  return true
}

export const joinLines = (lines = []) => lines.filter(isNonEmpty).join(newline)

export const joinSections = (sections = []) =>
  sections.filter(isNonEmpty).join(doubleNewline)

export default {
  newline,
  doubleNewline,
  joinLines,
  joinSections,
}
