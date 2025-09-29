const isCluePenalty = ({ name, taskId, taskIndex }) => {
  if (typeof name !== 'string') return false
  const matchesClueName = name.startsWith('Досрочная подсказка')
  if (!matchesClueName) return false

  if (taskId) return true
  return typeof taskIndex === 'number'
}

const removeCluePenalties = (timeAddings) => {
  if (!Array.isArray(timeAddings)) return []

  return timeAddings.filter((adding) => !isCluePenalty(adding))
}

export default removeCluePenalties
