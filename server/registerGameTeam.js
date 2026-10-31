import { randomUUID } from 'node:crypto'
import { getGameRegistrationError } from '../helpers/gameRegistration.js'
import { buildBalancedTaskSequences, isValidTaskSequence, isManualTaskSequence, resolveTemplateForTeam, normalizeStoredTaskDistributionTemplate, validateTaskDistributionTemplate } from '../helpers/taskDistribution.js'

const registrationFailure = (message, status = 409) =>
  Object.assign(new Error(message), { registrationStatus: status })

// Блокировка общая для игры, а не команды: подсчёт и запись нельзя разделять.
// Без автоматического истечения: зависший процесс не должен записать команду
// после передачи блокировки другому процессу. После аварии нужен ручной сброс.
export const registerGameTeam = async ({ db, gameId, teamId, role, createData = {} }) => {
  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')
  const token = randomUUID()
  const locked = await Games.findOneAndUpdate(
    { _id: gameId, registrationLock: null },
    { $set: { registrationLock: { token, acquiredAt: new Date() } } },
    { returnDocument: 'after', timestamps: false },
  ).lean()
  if (!locked) throw registrationFailure('Регистрация уже обрабатывается. Повторите попытку.')

  try {
    const manual = locked.participationMode !== 'player' && ['admin', 'dev'].includes(role)
    const error = getGameRegistrationError(locked, { manual })
    if (error) throw registrationFailure(error, 403)
    const existing = await GamesTeams.findOne({ gameId, teamId }).select({ _id: 1 }).lean()
    if (existing) throw registrationFailure('Команда уже зарегистрирована на эту игру')
    const count = await GamesTeams.countDocuments({ gameId })
    const capacityError = getGameRegistrationError(locked, { manual, teamsCount: count })
    if (capacityError) throw registrationFailure(capacityError)
    const prepared = { ...createData, gameId, teamId }
    if (locked.status === 'started' && locked.type !== 'story' && locked.taskDistributionMode === 'random') {
      const tasksCount = locked.tasks?.length || 0
      const gameTemplate = normalizeStoredTaskDistributionTemplate(locked.taskDistributionTemplate)
      const { template, source } = resolveTemplateForTeam({ gameTemplate, gameTeam: prepared, tasksCount })
      const validation = validateTaskDistributionTemplate(template, tasksCount)
      if (!validation.valid) throw registrationFailure(validation.messages.join('; '))
      if (isManualTaskSequence(prepared)) {
        if (!isValidTaskSequence(prepared.taskSequence, tasksCount)) {
          throw registrationFailure('Ручной маршрут команды некорректен')
        }
        return await GamesTeams.create(prepared)
      }
      // Читаем занятость и создаём маршрут под общей блокировкой регистрации:
      // следующая новая команда уже увидит маршрут предыдущей.
      const teams = await GamesTeams.find({ gameId }).select({ taskSequence: 1, taskDistributionTemplate: 1, taskSequenceSource: 1 }).lean()
      ;[prepared.taskSequence] = buildBalancedTaskSequences([{ template }], teams
        .filter(team => !isManualTaskSequence(team) && isValidTaskSequence(team.taskSequence, tasksCount))
        .map(team => ({ taskSequence: team.taskSequence, template: resolveTemplateForTeam({ gameTemplate, gameTeam: team, tasksCount }).template })))
      prepared.taskSequenceSource = source
      prepared.taskSequenceGeneratedAt = new Date()
    }
    return await GamesTeams.create(prepared)
  } finally {
    await Games.updateOne(
      { _id: gameId, 'registrationLock.token': token },
      { $unset: { registrationLock: 1 } },
      { timestamps: false },
    )
  }
}
