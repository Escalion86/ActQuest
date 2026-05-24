const isCluePenalty = ({ source }) => {
  const normalizedSource = typeof source === 'string' ? source.trim() : ''
  return normalizedSource === 'captain_force_clue'
}

const removeCluePenalties = (timeAddings) => {
  if (!Array.isArray(timeAddings)) return []

  return timeAddings.filter((adding) => !isCluePenalty(adding))
}

export default removeCluePenalties
