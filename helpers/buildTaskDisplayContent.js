const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : ''

const buildRichHeading = (label) => `<p><strong>${label}</strong></p>`

const buildPlainHeading = (label) => `${label}:`

const buildTaskDisplayContent = ({ task, visibleCluesCount = 0 }) => {
  const normalizedTask = task && typeof task === 'object' ? task : {}
  const taskRich = normalizeString(normalizedTask.taskRich)
  const taskText = normalizeString(normalizedTask.task)
  const clues = Array.isArray(normalizedTask.clues) ? normalizedTask.clues : []
  const safeVisibleCluesCount = Math.max(0, Number(visibleCluesCount) || 0)
  const visibleClues = clues.slice(0, safeVisibleCluesCount)

  const richParts = []
  const textParts = []
  const clueParts = []

  if (taskRich) {
    richParts.push(taskRich)
  }
  if (taskText) {
    textParts.push(taskText)
  }

  visibleClues.forEach((clue, index) => {
    const clueRich = normalizeString(clue?.clueRich)
    const clueText = normalizeString(clue?.clue)
    const label = `Подсказка ${index + 1}`

    if (clueRich) {
      richParts.push(`${buildRichHeading(label)}${clueRich}`)
      clueParts.push({
        index,
        label,
        html: clueRich,
        text: '',
      })
    } else if (clueText) {
      textParts.push(`${buildPlainHeading(label)}\n${clueText}`)
      clueParts.push({
        index,
        label,
        html: '',
        text: clueText,
      })
    }
  })

  return {
    html: richParts.join('').trim(),
    text: textParts.join('\n\n').trim(),
    taskHtml: taskRich,
    taskText,
    clues: clueParts,
  }
}

export default buildTaskDisplayContent
