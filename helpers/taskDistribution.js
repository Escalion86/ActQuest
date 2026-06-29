const toIntegerOrNull = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const integer = Math.trunc(numeric)
  return integer === numeric ? integer : null
}

const normalizeTasksCount = (tasksCount) => {
  const count = Number(tasksCount)
  return Number.isInteger(count) && count > 0 ? count : 0
}

const uniqueNumbers = (numbers) => [...new Set(numbers)]

export const buildLinearTaskSequence = (tasksCount) =>
  Array.from({ length: normalizeTasksCount(tasksCount) }, (_, index) => index)

export const normalizeTaskDistributionMode = (value) =>
  value === 'random' ? 'random' : 'linear'

export const normalizeTaskDistributionTemplate = (value, tasksCount = 0) => {
  const source = Array.isArray(value) ? value : []

  return source.map((block) => {
    const blockItems = Array.isArray(block) ? block : [block]

    return blockItems
      .map((item) => {
        const integer = toIntegerOrNull(item)
        if (integer === null) return null
        return integer - 1
      })
      .filter((item) => item !== null)
  })
}

export const formatTaskDistributionTemplate = (template) =>
  (Array.isArray(template) ? template : [])
    .map((block) => {
      const numbers = (Array.isArray(block) ? block : [block]).map(
        (index) => Number(index) + 1,
      )

      return numbers.length === 1 ? String(numbers[0]) : `[${numbers.join(',')}]`
    })
    .join(',')

export const validateTaskDistributionTemplate = (template, tasksCount) => {
  const count = normalizeTasksCount(tasksCount)
  const blocks = Array.isArray(template) ? template : []
  const seen = new Map()
  const outOfRangeTaskNumbers = []
  const hasEmptyBlock = blocks.some(
    (block) => !Array.isArray(block) || block.length === 0,
  )

  blocks.forEach((block) => {
    ;(Array.isArray(block) ? block : []).forEach((index) => {
      const taskIndex = toIntegerOrNull(index)
      if (taskIndex === null) return

      if (taskIndex < 0 || taskIndex >= count) {
        outOfRangeTaskNumbers.push(taskIndex + 1)
        return
      }

      seen.set(taskIndex, (seen.get(taskIndex) || 0) + 1)
    })
  })

  const missingTaskNumbers = []
  const duplicateTaskNumbers = []

  for (let index = 0; index < count; index += 1) {
    const hits = seen.get(index) || 0
    if (hits === 0) missingTaskNumbers.push(index + 1)
    if (hits > 1) duplicateTaskNumbers.push(index + 1)
  }

  const messages = []
  const uniqueOutOfRangeTaskNumbers = uniqueNumbers(outOfRangeTaskNumbers)

  if (count === 0) messages.push('Для случайного распределения нужны задания.')
  if (missingTaskNumbers.length > 0) {
    messages.push(`В шаблоне отсутствуют задания: ${missingTaskNumbers.join(', ')}`)
  }
  if (uniqueOutOfRangeTaskNumbers.length > 0) {
    messages.push(
      `В шаблоне указаны несуществующие задания: ${uniqueOutOfRangeTaskNumbers.join(', ')}`,
    )
  }
  duplicateTaskNumbers.forEach((number) => {
    messages.push(`Задание ${number} указано несколько раз`)
  })
  if (hasEmptyBlock) messages.push('В шаблоне есть пустой блок')

  return {
    valid: messages.length === 0,
    messages,
    missingTaskNumbers,
    duplicateTaskNumbers,
    outOfRangeTaskNumbers: uniqueOutOfRangeTaskNumbers,
    hasEmptyBlock,
  }
}

export const buildTaskSequenceFromTemplate = (template, random = Math.random) =>
  (Array.isArray(template) ? template : []).flatMap((block) => {
    const items = Array.isArray(block) ? [...block] : [block]

    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1))
      ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
    }

    return items
  })

export const isValidTaskSequence = (sequence, tasksCount) => {
  const expected = buildLinearTaskSequence(tasksCount)
  if (!Array.isArray(sequence) || sequence.length !== expected.length) return false

  const sequenceSet = new Set(sequence)
  if (sequenceSet.size !== expected.length) return false

  return expected.every((taskIndex) => sequenceSet.has(taskIndex))
}

export const getTeamTaskSequence = (game, gameTeam) => {
  const tasksCount = Array.isArray(game?.tasks) ? game.tasks.length : 0
  const sequence = Array.isArray(gameTeam?.taskSequence)
    ? gameTeam.taskSequence.map((item) => Number(item))
    : []

  return isValidTaskSequence(sequence, tasksCount)
    ? sequence
    : buildLinearTaskSequence(tasksCount)
}

export const getTaskIndexForStep = (game, gameTeam, step) => {
  const sequence = getTeamTaskSequence(game, gameTeam)
  const stepIndex = toIntegerOrNull(step)

  if (stepIndex === null || stepIndex < 0 || stepIndex >= sequence.length) {
    return null
  }

  return sequence[stepIndex]
}

const hasArrayProgress = (value, index) =>
  Array.isArray(value?.[index]) && value[index].length > 0

export const taskHasProgress = (gameTeam, taskIndex) => {
  if (Array.isArray(gameTeam?.startTime) && gameTeam.startTime[taskIndex]) return true
  if (Array.isArray(gameTeam?.endTime) && gameTeam.endTime[taskIndex]) return true
  if (hasArrayProgress(gameTeam?.findedCodes, taskIndex)) return true
  if (hasArrayProgress(gameTeam?.wrongCodes, taskIndex)) return true
  if (hasArrayProgress(gameTeam?.findedBonusCodes, taskIndex)) return true
  if (hasArrayProgress(gameTeam?.findedPenaltyCodes, taskIndex)) return true
  if (
    Array.isArray(gameTeam?.photos) &&
    Array.isArray(gameTeam.photos[taskIndex]?.photos) &&
    gameTeam.photos[taskIndex].photos.length > 0
  ) {
    return true
  }

  return (Array.isArray(gameTeam?.taskFailures) ? gameTeam.taskFailures : []).some(
    (item) => Number(item?.taskIndex) === taskIndex && item?.failedAt,
  )
}

export const getLockedTaskSequencePrefix = (gameTeam) => {
  const sequence = Array.isArray(gameTeam?.taskSequence) ? gameTeam.taskSequence : []
  const locked = []

  for (const taskIndex of sequence) {
    if (!taskHasProgress(gameTeam, taskIndex)) break
    locked.push(taskIndex)
  }

  return locked
}
