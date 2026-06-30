const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

const normalizePositiveInteger = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null
}

export const isScheduledGameForTeamEvent = (game) => {
  const status = normalizeText(game?.status).toLowerCase()
  if (status !== 'active') {
    return false
  }

  return !game?.dateStartFact && !game?.dateEndFact
}

export const buildGameOrderSiteEventMessage = (order) => {
  const parts = []
  const contactName = normalizeText(order?.contactName)
  const companyName = normalizeText(order?.companyName)
  const participantsCount = normalizePositiveInteger(order?.participantsCount)

  if (contactName) {
    parts.push(contactName)
  }
  if (companyName) {
    parts.push(companyName)
  }
  if (participantsCount) {
    parts.push(`${participantsCount} участников`)
  }

  return parts.length > 0
    ? `Новая заявка на проведение игры: ${parts.join(', ')}.`
    : 'Новая заявка на проведение игры.'
}
