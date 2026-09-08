// Защита закрытой игры от изменения заданий и игровых настроек.
// Закрытая игра считается завершённой: её задания и игровые параметры нельзя
// менять, чтобы не искажать результаты. Смена статуса (reopen), видимость
// результатов, финансы и служебные поля по-прежнему разрешены. Сравнение идёт
// по нормализованным отпечаткам: легитимные сохранения через другие модалки
// (финансы, настройки) отправляют задания без изменений и проходят проверку.

const CLOSED_GAME_IMMUTABLE_FIELD_LABELS = {
  type: 'тип игры',
  taskDuration: 'длительность задания',
  cluesDuration: 'длительность подсказок',
  breakDuration: 'длительность перерыва',
  taskFailurePenalty: 'штраф за слив задания',
  manyCodesPenalty: 'штраф за лишние коды',
  clueEarlyAccessMode: 'режим раннего доступа к подсказкам',
  clueEarlyPenalty: 'штраф за ранний доступ к подсказкам',
  clueEarlyAccessFrom: 'минута раннего доступа к подсказкам',
  allowCaptainForceClue: 'капитанское действие «открыть подсказку»',
  allowCaptainFailTask: 'капитанское действие «слить задание»',
  allowCaptainFinishBreak: 'капитанское действие «завершить перерыв»',
  useCustomTaskPublicTitles: 'произвольные публичные названия заданий',
  individualStart: 'индивидуальный старт',
  startingPlace: 'место старта',
  finishingPlace: 'место финиша',
  showFinishingPlace: 'показ места финиша',
  taskDistributionMode: 'режим распределения заданий',
  taskDistributionTemplate: 'шаблон распределения заданий',
}

const normalizeStringId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }

  return ''
}

const normalizeClosedGameString = (value) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeClosedGameStringList = (list) =>
  Array.isArray(list)
    ? list.map((item) =>
        typeof item === 'string' ? item.trim() : normalizeStringId(item),
      )
    : []

const normalizeClosedGameMediaUrls = (list) =>
  Array.isArray(list)
    ? list
        .map((item) =>
          typeof item === 'string'
            ? item.trim()
            : normalizeClosedGameString(item?.url),
        )
        .filter((url) => url !== '')
    : []

const normalizeClosedGameNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const normalizeClosedGameNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const canonicalizeClosedGameValue = (value) => {
  if (value === undefined) return null
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return value
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? value.toISOString() : null
  }
  if (Array.isArray(value)) return value.map(canonicalizeClosedGameValue)
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString()
    const result = {}
    Object.keys(value)
      .sort()
      .forEach((key) => {
        result[key] = canonicalizeClosedGameValue(value[key])
      })
    return result
  }
  return String(value)
}

const normalizeClosedGameCodeList = (list, valueKey) =>
  (Array.isArray(list) ? list : []).map((item) => ({
    id: normalizeStringId(item?._id ?? item?.id),
    code: normalizeClosedGameString(item?.code),
    value: normalizeClosedGameNumber(item?.[valueKey]),
    description: normalizeClosedGameString(item?.description),
    image:
      typeof item?.image === 'string'
        ? item.image.trim()
        : normalizeClosedGameString(item?.image?.url),
    storyEffects: (
      Array.isArray(item?.storyEffects) ? item.storyEffects : []
    ).map((effect) => canonicalizeClosedGameValue(effect)),
  }))

const normalizeClosedGameDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

const normalizeClosedGameManyCodesPenalty = (value) => {
  const list = Array.isArray(value) ? value : []
  return [normalizeClosedGameNumber(list[0]), normalizeClosedGameNumber(list[1])]
}

const buildClosedGameTaskFingerprint = (task) => {
  const source = task || {}
  return JSON.stringify({
    id: normalizeStringId(source._id ?? source.id),
    publicTitle: normalizeClosedGameString(source.publicTitle),
    title: normalizeClosedGameString(source.title),
    task: normalizeClosedGameString(source.task),
    howToSolve: normalizeClosedGameString(source.howToSolve),
    taskRich: normalizeClosedGameString(source.taskRich),
    postMessage: normalizeClosedGameString(source.postMessage),
    postMessageRich: normalizeClosedGameString(source.postMessageRich),
    codes: normalizeClosedGameStringList(source.codes),
    images: normalizeClosedGameStringList(source.images),
    codePhotos: normalizeClosedGameMediaUrls(source.codePhotos),
    taskMedia: normalizeClosedGameMediaUrls(source.taskMedia),
    postMessageMedia: normalizeClosedGameMediaUrls(source.postMessageMedia),
    clues: (Array.isArray(source.clues) ? source.clues : []).map((clue) => ({
      id: normalizeStringId(clue?._id ?? clue?.id),
      clue: normalizeClosedGameString(clue?.clue),
      clueRich: normalizeClosedGameString(clue?.clueRich),
      images: normalizeClosedGameStringList(clue?.images),
    })),
    subTasks: (Array.isArray(source.subTasks) ? source.subTasks : []).map(
      (subTask) => ({
        id: normalizeStringId(subTask?._id ?? subTask?.id),
        name: normalizeClosedGameString(subTask?.name),
        task: normalizeClosedGameString(subTask?.task),
        bonus: normalizeClosedGameNumber(subTask?.bonus),
      }),
    ),
    penaltyCodes: normalizeClosedGameCodeList(source.penaltyCodes, 'penalty'),
    bonusCodes: normalizeClosedGameCodeList(source.bonusCodes, 'bonus'),
    numCodesToCompliteTask: normalizeClosedGameNullableNumber(
      source.numCodesToCompliteTask,
    ),
    canceled: Boolean(source.canceled),
    isBonusTask: Boolean(source.isBonusTask),
    taskBonusForComplite: normalizeClosedGameNumber(source.taskBonusForComplite),
    coordinates: {
      latitude: normalizeClosedGameNullableNumber(source.coordinates?.latitude),
      longitude: normalizeClosedGameNullableNumber(
        source.coordinates?.longitude,
      ),
      radius: normalizeClosedGameNullableNumber(source.coordinates?.radius),
    },
    agentUserIds: normalizeClosedGameStringList(source.agentUserIds).sort(),
  })
}

const buildClosedGamePrequelFingerprint = (prequel) => {
  const source = prequel || {}
  return JSON.stringify({
    enabled: Boolean(source.enabled),
    openAt: normalizeClosedGameDate(source.openAt),
    description: normalizeClosedGameString(source.description),
    descriptionRich: normalizeClosedGameString(source.descriptionRich),
    descriptionMedia: normalizeClosedGameMediaUrls(source.descriptionMedia),
    mode: normalizeClosedGameString(source.mode) || 'multi_hit',
    bonusCodes: normalizeClosedGameCodeList(source.bonusCodes, 'value'),
    penaltyCodes: normalizeClosedGameCodeList(source.penaltyCodes, 'value'),
    wrongAttemptsLimit: normalizeClosedGameNullableNumber(
      source.wrongAttemptsLimit,
    ),
    wrongAttemptsPenalty: normalizeClosedGameNumber(source.wrongAttemptsPenalty),
    wrongAttemptsStoryEffects: (
      Array.isArray(source.wrongAttemptsStoryEffects)
        ? source.wrongAttemptsStoryEffects
        : []
    ).map((effect) => canonicalizeClosedGameValue(effect)),
  })
}

const resolveClosedGamePrequelList = (game) => {
  const prequels = Array.isArray(game?.prequels) ? game.prequels : []
  if (prequels.length > 0) return prequels
  return game?.prequel ? [game.prequel] : []
}

const areClosedGameScalarValuesEqual = (nextValue, prevValue) => {
  if (typeof nextValue === 'boolean' || typeof prevValue === 'boolean') {
    return Boolean(nextValue) === Boolean(prevValue)
  }
  if (typeof nextValue === 'number' || typeof prevValue === 'number') {
    return (
      normalizeClosedGameNumber(nextValue) === normalizeClosedGameNumber(prevValue)
    )
  }
  return (
    normalizeClosedGameString(String(nextValue ?? '')) ===
    normalizeClosedGameString(String(prevValue ?? ''))
  )
}

// Возвращает человекочитаемое название первого изменённого «замороженного»
// поля или null, если обновление не трогает задания и игровые настройки.
const resolveClosedGameUpdateViolation = ({ updateData, existingGame }) => {
  for (const [field, label] of Object.entries(
    CLOSED_GAME_IMMUTABLE_FIELD_LABELS,
  )) {
    if (!Object.prototype.hasOwnProperty.call(updateData, field)) {
      continue
    }

    const isStructuredField =
      field === 'manyCodesPenalty' || field === 'taskDistributionTemplate'
    const prevValue = isStructuredField
      ? canonicalizeClosedGameValue(
          field === 'manyCodesPenalty'
            ? normalizeClosedGameManyCodesPenalty(existingGame?.[field])
            : existingGame?.[field],
        )
      : existingGame?.[field]
    const nextValue = isStructuredField
      ? canonicalizeClosedGameValue(
          field === 'manyCodesPenalty'
            ? normalizeClosedGameManyCodesPenalty(updateData[field])
            : updateData[field],
        )
      : updateData[field]
    const isEqual = isStructuredField
      ? JSON.stringify(nextValue) === JSON.stringify(prevValue)
      : areClosedGameScalarValuesEqual(nextValue, prevValue)

    if (!isEqual) {
      return label
    }
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'tasks')) {
    const prevTasks = Array.isArray(existingGame?.tasks)
      ? existingGame.tasks
      : []
    const nextTasks = Array.isArray(updateData.tasks) ? updateData.tasks : []
    if (nextTasks.length !== prevTasks.length) {
      return 'задания'
    }
    const prevFingerprint = prevTasks
      .map(buildClosedGameTaskFingerprint)
      .join('\n')
    const nextFingerprint = nextTasks
      .map(buildClosedGameTaskFingerprint)
      .join('\n')
    if (nextFingerprint !== prevFingerprint) {
      return 'задания'
    }
  }

  const hasPrequelUpdate =
    Object.prototype.hasOwnProperty.call(updateData, 'prequels') ||
    Object.prototype.hasOwnProperty.call(updateData, 'prequel')
  if (hasPrequelUpdate) {
    const prevList = resolveClosedGamePrequelList(existingGame)
    const nextList = resolveClosedGamePrequelList(updateData)
    if (nextList.length !== prevList.length) {
      return 'приквел'
    }
    const prevFingerprint = prevList
      .map(buildClosedGamePrequelFingerprint)
      .join('\n')
    const nextFingerprint = nextList
      .map(buildClosedGamePrequelFingerprint)
      .join('\n')
    if (nextFingerprint !== prevFingerprint) {
      return 'приквел'
    }
  }

  return null
}

export {
  resolveClosedGameUpdateViolation,
  buildClosedGameTaskFingerprint,
  buildClosedGamePrequelFingerprint,
  CLOSED_GAME_IMMUTABLE_FIELD_LABELS,
}
