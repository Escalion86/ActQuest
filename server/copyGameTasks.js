import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import sanitize from '@helpers/sanitize'
import {
  isValidTaskSequence,
  normalizeStoredTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'

export class TaskCopyError extends Error {
  constructor(message, status = 409) {
    super(message)
    this.status = status
  }
}

// Сравнение сырых BSON-полей обходит schema defaults в старых документах.
// CAS проверяет также права и статус, даже при изменении вне Mongoose timestamps.
export const copySnapshotFilter = (doc, fields) => ({
  _id: doc._id,
  $expr: {
    $and: fields.map((key) => ({
      $eq: [{ $ifNull: [`$${key}`, null] }, { $literal: doc[key] ?? null }],
    })),
  },
})

export const copyGuardFields = [
  'tasks', 'taskCopyOperations', 'status', 'location', 'type',
  'creatorUserId', 'creatorTelegramId', 'moderators', 'agents', 'classicItems',
  'taskDistributionMode', 'taskDistributionTemplate', 'updatedAt',
]

export const taskCopyBlockReason = (task) => {
  if (task?.variantConfig?.enabled || task?.variants?.length || task?.itemRewards || task?.outcomeRewards) {
    return 'Задание содержит варианты, условия или награды предметами. Их связи с предметами и другими этапами нельзя безопасно перенести отдельно. Скопируйте игру целиком.'
  }
  return ''
}

const cloneContent = (value, key = '') => {
  if (Array.isArray(value)) return value.map((item) => cloneContent(item))
  if (value && typeof value === 'object') {
    if (value instanceof Date) return new Date(value)
    if (value._bsontype === 'ObjectId') return new Types.ObjectId()
    return Object.fromEntries(Object.entries(value)
      .filter(([name]) => name !== 'mongoId' && name !== '__v')
      .map(([name, item]) => [name,
        name === '_id' ? new Types.ObjectId()
          : name === 'id' || name === 'stageKey' ? randomUUID()
            : name === 'agentUserIds' ? []
              : cloneContent(item, name),
      ]))
  }
  return key.endsWith('Rich') && typeof value === 'string' ? sanitize(value) : value
}

export const buildCopiedTasks = (Games, tasks) => {
  for (const task of tasks) {
    const reason = taskCopyBlockReason(task)
    if (reason) throw new TaskCopyError(`«${task.title || 'Без названия'}»: ${reason}`)
  }
  const copies = tasks.map((task) => ({ ...cloneContent(task), _id: new Types.ObjectId(), stageKey: randomUUID(), agentUserIds: [] }))
  const draft = new Games({ tasks: copies })
  const error = draft.validateSync(['tasks'])
  if (error) throw new TaskCopyError('Сохранённые задания содержат некорректные данные. Исправьте их в источнике перед копированием.', 400)
  return draft.tasks.toObject()
}

export const extendCopyTemplate = (template, oldCount, newCount) => [
  ...template,
  ...Array.from({ length: newCount - oldCount }, (_, index) => [oldCount + index]),
]

export const validateCopyDistribution = (game, teams) => {
  if (game.taskDistributionMode !== 'random') return
  if (!game.tasks?.length && !game.taskDistributionTemplate?.length && !teams.some((team) => team.taskSequence?.length || team.taskDistributionTemplate?.length)) return
  const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
  const errors = []
  const pushError = (message) => {
    if (!errors.includes(message)) errors.push(message)
  }
  const validateTemplate = (template, label) => {
    const { valid, messages } = validateTaskDistributionTemplate(template, tasksCount)
    if (!valid) {
      pushError(`${label} некорректен: ${messages.join('; ') || 'недопустимые значения'}`)
    }
  }

  validateTemplate(
    normalizeStoredTaskDistributionTemplate(game.taskDistributionTemplate),
    'Общий шаблон распределения',
  )

  for (const team of teams) {
    const label = team.name ? `«${team.name}»` : String(team.teamId || team._id)
    if (team.taskDistributionTemplate?.length) {
      validateTemplate(
        normalizeStoredTaskDistributionTemplate(team.taskDistributionTemplate),
        `Индивидуальный шаблон команды ${label}`,
      )
    }
    if (
      team.taskSequence?.length &&
      !isValidTaskSequence(team.taskSequence, tasksCount)
    ) {
      pushError(
        `Маршрут команды ${label} не является полной перестановкой заданий. Распределите задания для команды заново.`,
      )
    }
  }

  if (errors.length) throw new TaskCopyError(`Сначала исправьте распределение заданий целевой игры: ${errors[0]}`)
}

// Общий шаблон дополняется атомарно вместе с tasks. Индивидуальные данные
// дополняются CAS-записями; повтор запроса восстанавливает незавершённую синхронизацию.
// Существующий префикс маршрута и метаданные распределения не меняются.
export const syncCopiedTaskRoutes = async ({ db, gameId, minimumCount }) => {
  const Games = db.model('Games'), Teams = db.model('GamesTeams')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const game = await Games.collection.findOne({ _id: gameId })
    if (game?.taskDistributionMode !== 'random') return
    const count = game.tasks.length
    const teams = await Teams.collection.find({ gameId: String(gameId) }).toArray()
    let retry = false
    for (const team of teams) {
      const changes = {}
      if (team.taskSequence?.length && (!isValidTaskSequence(team.taskSequence, team.taskSequence.length) || team.taskSequence.length < minimumCount)) {
        throw new TaskCopyError('Маршрут команды изменён или повреждён во время копирования. Исправьте распределение и повторите этот же запрос.', 503)
      }
      if (team.taskDistributionTemplate?.length) {
        const oldCount = team.taskDistributionTemplate.flat().length
        if (oldCount < minimumCount || !validateTaskDistributionTemplate(team.taskDistributionTemplate, oldCount).valid) {
          throw new TaskCopyError('Индивидуальный шаблон изменён или повреждён во время копирования. Исправьте распределение и повторите этот же запрос.', 503)
        }
        if (oldCount < count && validateTaskDistributionTemplate(team.taskDistributionTemplate, oldCount).valid) {
          changes.taskDistributionTemplate = extendCopyTemplate(team.taskDistributionTemplate, oldCount, count)
        }
      }
      if (team.taskSequence?.length && team.taskSequence.length < count && isValidTaskSequence(team.taskSequence, team.taskSequence.length)) {
        changes.taskSequence = [
          ...team.taskSequence,
          ...Array.from({ length: count - team.taskSequence.length }, (_, index) => team.taskSequence.length + index),
        ]
      }
      if (!Object.keys(changes).length) continue
      const updated = await Teams.collection.findOneAndUpdate(
        copySnapshotFilter(team, ['taskDistributionTemplate', 'taskSequence']),
        { $set: changes }, { returnDocument: 'after' },
      )
      if (!updated) retry = true
    }
    const latest = await Games.collection.findOne({ _id: gameId })
    if (!retry && latest.tasks.length === count) {
      const finalTeams = await Teams.collection.find({ gameId: String(gameId) }).toArray()
      validateCopyDistribution(latest, finalTeams)
      return
    }
  }
  throw new TaskCopyError('Задания добавлены, но маршруты изменились одновременно. Повторите этот же запрос для завершения.', 503)
}
