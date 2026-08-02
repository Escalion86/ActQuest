const EXACT_LABELS = new Map([
  ['game.name', 'Название игры'],
  ['game.type', 'Тип игры'],
  ['game.location', 'Город'],
  ['game.dateStart', 'Плановое начало'],
  ['game.individualStart', 'Индивидуальный старт для команд'],
  ['game.participationMode', 'Тип участия'],
  ['game.startingPlace', 'Место сбора'],
  ['game.finishingPlace', 'Место окончания'],
  ['game.showFinishingPlace', 'Показывать место окончания'],
  ['game.description', 'Описание'],
  ['game.descriptionRich', 'Описание'],
  ['game.descriptionMedia', 'Медиа описания'],
  ['game.image', 'Обложка игры'],
  ['game.creatorUserId', 'Организатор игры'],
  ['game.creatorTelegramId', 'Организатор игры'],
  ['game.creator', 'Организатор игры'],
  ['game.moderators', 'Модераторы игры'],
  ['game.agents', 'Агенты игры'],
  ['game.agentNotifications', 'Настройки уведомлений агентов'],
  [
    'game.agentNotifications.onPreviousTask',
    'Уведомлять на предыдущем задании',
  ],
  ['game.agentNotifications.onCurrentTask', 'Уведомлять на задании агента'],
  ['game.agentNotifications.onTaskCompleted', 'Уведомлять после выполнения'],
  ['game.storyConfig', 'Story-настройки'],
  ['game.finances', 'Финансы'],
  ['game.prices', 'Цены'],
  ['game.tasks', 'Задания'],
  ['game.status', 'Статус игры'],
  ['game.result', 'Результаты игры'],
  ['game.result.computed', 'Результаты игры'],
  ['game.result.teamsPlaces', 'Места команд'],
  ['game.isResultGenerated', 'Результаты сформированы'],
  ['gameTeams', 'Команды в игре'],
])

const SEGMENT_LABELS = new Map([
  ['game', 'Игра'],
  ['gameTeams', 'Команды в игре'],
  ['name', 'Название'],
  ['type', 'Тип'],
  ['location', 'Город'],
  ['dateStart', 'Плановое начало'],
  ['individualStart', 'Индивидуальный старт'],
  ['participationMode', 'Тип участия'],
  ['startingPlace', 'Место сбора'],
  ['finishingPlace', 'Место окончания'],
  ['showFinishingPlace', 'Показывать место окончания'],
  ['description', 'Описание'],
  ['descriptionRich', 'Описание'],
  ['descriptionMedia', 'Медиа описания'],
  ['image', 'Обложка'],
  ['creator', 'Организатор'],
  ['creatorUserId', 'Организатор'],
  ['creatorTelegramId', 'Организатор'],
  ['moderators', 'Модераторы'],
  ['agents', 'Агенты'],
  ['agentNotifications', 'Настройки уведомлений агентов'],
  ['onPreviousTask', 'Уведомлять на предыдущем задании'],
  ['onCurrentTask', 'Уведомлять на задании агента'],
  ['onTaskCompleted', 'Уведомлять после выполнения'],
  ['storyConfig', 'Story-настройки'],
  ['finances', 'Финансы'],
  ['prices', 'Цены'],
  ['tasks', 'Задания'],
  ['status', 'Статус'],
  ['result', 'Результаты'],
  ['computed', 'Рассчитанные результаты'],
  ['teamsPlaces', 'Места команд'],
  ['isResultGenerated', 'Результаты сформированы'],
])

const HUMANIZED_ARRAY_PREFIXES = [
  { prefix: 'game.tasks.', label: 'Задания' },
  { prefix: 'game.finances.', label: 'Финансы' },
  { prefix: 'game.prices.', label: 'Цены' },
  { prefix: 'gameTeams.', label: 'Команды в игре' },
]

const formatFallbackSegment = (segment) => {
  if (!segment) {
    return ''
  }

  const mapped = SEGMENT_LABELS.get(segment)
  if (mapped) {
    return mapped
  }

  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase())
}

const formatGameHistoryLabel = (path = '') => {
  const normalizedPath = typeof path === 'string' ? path.trim() : ''
  if (!normalizedPath) {
    return 'Изменение'
  }

  const exactLabel = EXACT_LABELS.get(normalizedPath)
  if (exactLabel) {
    return exactLabel
  }

  for (const entry of HUMANIZED_ARRAY_PREFIXES) {
    if (normalizedPath.startsWith(entry.prefix)) {
      return entry.label
    }
  }

  const segments = normalizedPath
    .split('.')
    .filter((segment) => segment && !/^\d+$/.test(segment))
  if (segments.length === 0) {
    return normalizedPath
  }

  return segments.map((segment) => formatFallbackSegment(segment)).join(' -> ')
}

export default formatGameHistoryLabel
