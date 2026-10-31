const toIntegerOrNull = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const integer = Math.trunc(numeric)
  return integer === numeric ? integer : null
}

const toStoredIntegerOrNull = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    (typeof value !== 'number' && typeof value !== 'string')
  ) {
    return null
  }

  const prepared = typeof value === 'string' ? value.trim() : value
  if (prepared === '') return null

  return toIntegerOrNull(prepared)
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
  void tasksCount
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

export const normalizeStoredTaskDistributionTemplate = (
  value,
  tasksCount = 0,
) => {
  void tasksCount
  const source = Array.isArray(value) ? value : []

  return source.map((block) => {
    const blockItems = Array.isArray(block) ? block : [block]

    return blockItems
      .map((item) => toStoredIntegerOrNull(item))
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

export const removeTaskFromDistributionTemplate = (template, taskIndex) => {
  const task = toStoredIntegerOrNull(taskIndex)
  const blocks = Array.isArray(template) ? template : []

  if (task === null) {
    return blocks.map((block) => (Array.isArray(block) ? [...block] : []))
  }

  return blocks.map((block) =>
    (Array.isArray(block) ? block : []).filter((item) => item !== task),
  )
}

export const moveTaskInDistributionTemplate = ({
  template,
  taskIndex,
  toBlockIndex,
  toItemIndex = null,
}) => {
  const task = toStoredIntegerOrNull(taskIndex)
  const destinationBlockIndex = toStoredIntegerOrNull(toBlockIndex)

  const nextTemplate = removeTaskFromDistributionTemplate(template, taskIndex)

  if (task === null || destinationBlockIndex === null || destinationBlockIndex < 0) {
    return nextTemplate
  }

  while (nextTemplate.length <= destinationBlockIndex) {
    nextTemplate.push([])
  }

  const destinationBlock = nextTemplate[destinationBlockIndex]
  const preparedItemIndex = toStoredIntegerOrNull(toItemIndex)
  const insertIndex =
    preparedItemIndex === null
      ? destinationBlock.length
      : Math.max(0, Math.min(preparedItemIndex, destinationBlock.length))

  destinationBlock.splice(insertIndex, 0, task)
  return nextTemplate
}

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

// Минимальная суммарная занятость точек: одна строка на шаг маршрута,
// один столбец на задание. Венгерский алгоритм не перебирает n! перестановок.
const assignLeastOccupied = (items, offset, occupancy) => {
  const size = items.length
  const u = Array(size + 1).fill(0), v = Array(size + 1).fill(0)
  const matched = Array(size + 1).fill(0), previous = Array(size + 1).fill(0)
  for (let row = 1; row <= size; row += 1) {
    matched[0] = row
    let column = 0
    const distance = Array(size + 1).fill(Infinity)
    const used = Array(size + 1).fill(false)
    do {
      used[column] = true
      const currentRow = matched[column]
      let delta = Infinity, nextColumn = 0
      for (let candidate = 1; candidate <= size; candidate += 1) {
        if (used[candidate]) continue
        const cost = (occupancy[offset + currentRow - 1]?.get(items[candidate - 1]) || 0) - u[currentRow] - v[candidate]
        if (cost < distance[candidate]) {
          distance[candidate] = cost
          previous[candidate] = column
        }
        if (distance[candidate] < delta) { delta = distance[candidate]; nextColumn = candidate }
      }
      for (let candidate = 0; candidate <= size; candidate += 1) {
        if (used[candidate]) { u[matched[candidate]] += delta; v[candidate] -= delta }
        else distance[candidate] -= delta
      }
      column = nextColumn
    } while (matched[column] !== 0)
    do {
      const nextColumn = previous[column]
      matched[column] = matched[nextColumn]
      column = nextColumn
    } while (column !== 0)
  }
  const result = Array(size)
  for (let column = 1; column <= size; column += 1) result[matched[column] - 1] = items[column - 1]
  return result
}

// Балансируем каждый шаг случайного блока, а не только стартовую точку.
// Готовые маршруты и начатые префиксы участвуют в подсчёте, но не меняются.
const buildBalancedGroup = (requests, fixedSequences = [], random = Math.random) => {
  const occupancy = []
  const record = (sequence, offset = 0) => sequence.forEach((task, index) => {
    const counts = occupancy[offset + index] ||= new Map()
    counts.set(task, (counts.get(task) || 0) + 1)
  })
  fixedSequences.forEach(sequence => record(sequence))
  requests.forEach(request => record(request.lockedPrefix || []))
  const result = new Map()
  const shuffled = buildTaskSequenceFromTemplate([requests.map((_, index) => index)], random)
  for (const index of shuffled) {
    const request = requests[index]
    const sequence = [...(request.lockedPrefix || [])]
    const locked = new Set(sequence)
    for (const block of request.template) {
      const remaining = block.filter(task => !locked.has(task))
      const items = buildTaskSequenceFromTemplate([remaining], random)
      const assigned = assignLeastOccupied(items, sequence.length, occupancy)
      record(assigned, sequence.length)
      sequence.push(...assigned)
    }
    result.set(index, sequence)
  }
  return requests.map((_, index) => result.get(index))
}

// Порядок блоков значим; порядок перечисления заданий внутри блока — нет.
export const taskDistributionGroupKey = template => JSON.stringify(
  template.map(block => [...block].sort((a, b) => a - b)),
)

// Сохранённый маршрут без признака автоматической генерации считаем ручным.
export const isManualTaskSequence = team => Boolean(team?.taskSequence?.length) &&
  !['game_template', 'team_template'].includes(team.taskSequenceSource)

export const buildBalancedTaskSequences = (requests, fixedRoutes = [], random = Math.random) => {
  const groups = new Map()
  requests.forEach((request, index) => {
    const key = taskDistributionGroupKey(request.template)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ request, index })
  })
  const result = Array(requests.length)
  for (const [key, entries] of groups) {
    const fixed = fixedRoutes.filter(route => taskDistributionGroupKey(route.template) === key)
      .map(route => route.taskSequence)
    const sequences = buildBalancedGroup(entries.map(entry => entry.request), fixed, random)
    entries.forEach((entry, index) => { result[entry.index] = sequences[index] })
  }
  return result
}

export const mergeTaskSequenceWithLockedPrefix = (generatedSequence, lockedPrefix) => {
  const locked = Array.isArray(lockedPrefix)
    ? lockedPrefix
        .map((item) => toIntegerOrNull(item))
        .filter((item) => item !== null)
    : []
  const lockedSet = new Set(locked)
  const generated = Array.isArray(generatedSequence)
    ? generatedSequence
        .map((item) => toIntegerOrNull(item))
        .filter((item) => item !== null)
    : []

  return [
    ...locked,
    ...generated.filter((taskIndex) => !lockedSet.has(taskIndex)),
  ]
}

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

// Совместимое имя: отсутствие маршрута больше не требует ручного распределения.
export const getTaskDistributionStartErrors = (game, gameTeams = []) =>
  validateTaskDistributionForGame(game, gameTeams).errors

// Пустой индивидуальный шаблон означает использование общего шаблона.
export const resolveTemplateForTeam = ({ gameTemplate, gameTeam, tasksCount }) => {
  const raw = gameTeam?.taskDistributionTemplate
  const hasTeamTemplate = raw != null && (!Array.isArray(raw) || raw.length > 0)
  return {
    template: hasTeamTemplate
      ? normalizeStoredTaskDistributionTemplate(raw, tasksCount)
      : gameTemplate,
    source: hasTeamTemplate ? 'team_template' : 'game_template',
  }
}

const isStoredTemplateWellFormed = (value) =>
  Array.isArray(value) &&
  value.every((block) =>
    (Array.isArray(block) ? block : [block]).every(
      (item) => toStoredIntegerOrNull(item) !== null,
    ),
  )

// Порядок блоков фиксирован, порядок заданий внутри блока несущественен.
export const isTaskSequenceCompatibleWithTemplate = (sequence, template, tasksCount) => {
  if (!isValidTaskSequence(sequence, tasksCount)) return false
  if (!isStoredTemplateWellFormed(template)) return false
  if (!validateTaskDistributionTemplate(template, tasksCount).valid) return false
  let offset = 0
  return template.every((block) => {
    const items = new Set(block)
    const matches = sequence.slice(offset, offset + block.length).every((index) => items.has(index))
    offset += block.length
    return matches
  })
}

// Проверка без генерации и записей, общая для «Проверить игру» и старта.
export const validateTaskDistributionForGame = (game, gameTeams = []) => {
  const missing = []
  const errors = []
  if (
    !['classic', 'photo'].includes(game?.type) ||
    normalizeTaskDistributionMode(game?.taskDistributionMode) !== 'random'
  ) {
    return { missing, errors }
  }
  const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
  const gameTemplate = normalizeStoredTaskDistributionTemplate(
    game.taskDistributionTemplate,
  )
  const validate = (raw, template, label) => {
    const validation = validateTaskDistributionTemplate(template, tasksCount)
    if (!isStoredTemplateWellFormed(raw) || !validation.valid) {
      errors.push(
        `${label} некорректен: ${validation.messages.join('; ') || 'недопустимые значения'}`,
      )
    }
  }
  validate(game.taskDistributionTemplate, gameTemplate, 'Общий шаблон распределения')
  for (const team of gameTeams) {
    const label = team.name ? `«${team.name}»` : String(team.teamId || team._id)
    const { template, source } = resolveTemplateForTeam({
      gameTemplate,
      gameTeam: team,
      tasksCount,
    })
    if (source === 'team_template') {
      validate(
        team.taskDistributionTemplate,
        template,
        `Индивидуальный шаблон команды ${label}`,
      )
    }
    if (isValidTaskSequence(team.taskSequence, tasksCount)) {
      if (!isTaskSequenceCompatibleWithTemplate(team.taskSequence, template, tasksCount)) {
        errors.push(`Маршрут команды ${label} не соответствует текущему шаблону. Распределите задания для команды заново.`)
      }
      continue
    }
    if (
      team.taskSequence != null &&
      (!Array.isArray(team.taskSequence) || team.taskSequence.length > 0)
    ) {
      errors.push(
        `Маршрут команды ${label} повреждён. Распределите задания для команды заново.`,
      )
      continue
    }
    missing.push({ id: team._id, template, source })
  }
  return { missing, errors }
}

// Генерируем только отсутствующие маршруты после полной успешной проверки.
export const prepareTaskDistributionForStart = (game, gameTeams = []) => {
  const { missing, errors } = validateTaskDistributionForGame(game, gameTeams)
  if (errors.length > 0) return { errors, updates: [] }
  const pendingIds = new Set(missing.map(item => String(item.id)))
  const sequences = buildBalancedTaskSequences(missing, gameTeams
    .filter(team => !pendingIds.has(String(team._id)) && !isManualTaskSequence(team) && isValidTaskSequence(team.taskSequence, game.tasks?.length))
    .map(team => ({ taskSequence: team.taskSequence, template: resolveTemplateForTeam({
      gameTemplate: normalizeStoredTaskDistributionTemplate(game.taskDistributionTemplate), gameTeam: team, tasksCount: game.tasks?.length,
    }).template })))
  return {
    errors,
    updates: missing.map(({ id, source }, index) => ({
      id,
      taskSequence: sequences[index],
      taskSequenceSource: source,
    })),
  }
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
