import { randomUUID } from 'node:crypto'
import { toStringId } from '../helpers/idAndDate.js'
import { isCompletedParticipationStatus } from '../helpers/gameParticipation.js'
import { getGameRegistrationError } from '../helpers/gameRegistration.js'
import { buildBalancedTaskSequences, isValidTaskSequence, isManualTaskSequence, resolveTemplateForTeam, normalizeStoredTaskDistributionTemplate, validateTaskDistributionTemplate } from '../helpers/taskDistribution.js'

const registrationFailure = (message, status = 409) =>
  Object.assign(new Error(message), { registrationStatus: status })

// Блокировка охватывает проверку и запись. При работе с этапом сначала
// блокируется этап, затем проведение.
// Без автоматического истечения: зависший процесс не должен записать команду
// после передачи блокировки другому процессу. После аварии нужен ручной сброс.
const withRegistrationLock = async (model, filter, run) => {
  const token = randomUUID()
  const locked = await model.findOneAndUpdate(
    { ...filter, registrationLock: null },
    { $set: { registrationLock: { token, acquiredAt: new Date() } } },
    { returnDocument: 'after', timestamps: false },
  ).lean()
  if (!locked) throw registrationFailure('Регистрация уже обрабатывается. Повторите попытку.')

  try {
    return await run(locked)
  } finally {
    await model.updateOne(
      { _id: locked._id, 'registrationLock.token': token },
      { $unset: { registrationLock: 1 } },
      { timestamps: false },
    )
  }
}

export const withGameRegistrationLock = ({ db, gameId, stageId = null }, run) =>
  withRegistrationLock(db.model('Games'), { _id: gameId, stageId }, run)

export const withGameStageRegistrationLock = ({ db, stageId }, run) =>
  withRegistrationLock(db.model('GameStages'), { _id: stageId }, run)

const checkOtherDates = async ({ db, GamesTeams, dates, teamId }) => {
  if (!dates.length) return

  const playedDates = dates.filter((date) => isCompletedParticipationStatus(date.status))
  const wasRegistered = playedDates.some((date) => (date.result?.gameTeams || [])
    .some((registration) => toStringId(registration.teamId) === toStringId(teamId)))
  if (wasRegistered) throw registrationFailure('Команда уже зарегистрирована на другую дату этого этапа')

  const TeamsUsers = db.model('TeamsUsers')
  const userIds = (await TeamsUsers.distinct('userId', { teamId })).map(toStringId).filter(Boolean)
  if (!userIds.length) return

  const userIdsSet = new Set(userIds)
  const playedByMember = playedDates.some((date) => (date.result?.teamsUsers || [])
    .some((membership) => userIdsSet.has(toStringId(membership.userId))))
  if (playedByMember) throw registrationFailure('В составе команды уже есть участник другой даты этого этапа')

  const upcomingDateIds = dates
    .filter((date) => !isCompletedParticipationStatus(date.status))
    .map((date) => toStringId(date._id))
  if (!upcomingDateIds.length) return

  const otherTeamIds = await GamesTeams.distinct('teamId', { gameId: { $in: upcomingDateIds } })
  if (otherTeamIds.length && await TeamsUsers.exists({ teamId: { $in: otherTeamIds }, userId: { $in: userIds } })) {
    throw registrationFailure('В составе команды уже есть участник другой даты этого этапа')
  }
}

export const registerGameTeam = async ({ db, gameId, teamId, role, createData = {} }) => {
  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')
  const currentGame = await Games.findById(gameId).select({ stageId: 1 }).lean()
  if (!currentGame) throw registrationFailure('Игра не найдена', 404)
  const stageId = currentGame.stageId ?? null

  const register = async (game) => {
    const manual = game.participationMode !== 'player' && ['admin', 'dev'].includes(role)
    const error = getGameRegistrationError(game, { manual })
    if (error) throw registrationFailure(error, 403)
    const stageGames = stageId
      ? await Games.find({ stageId, status: { $ne: 'canceled' } })
          .select({ _id: 1, status: 1, 'result.gameTeams.teamId': 1, 'result.teamsUsers.userId': 1 })
          .lean()
      : []
    const existing = await GamesTeams.findOne({
      gameId: stageId ? { $in: stageGames.map((entry) => toStringId(entry._id)) } : gameId,
      teamId,
    }).select({ gameId: 1 }).lean()
    if (existing) {
      throw registrationFailure(toStringId(existing.gameId) === toStringId(gameId)
        ? 'Команда уже зарегистрирована на эту игру'
        : 'Команда уже зарегистрирована на другую дату этого этапа')
    }
    await checkOtherDates({
      db,
      GamesTeams,
      dates: stageGames.filter((entry) => toStringId(entry._id) !== toStringId(gameId)),
      teamId,
    })
    const count = await GamesTeams.countDocuments({ gameId })
    const capacityError = getGameRegistrationError(game, { manual, teamsCount: count })
    if (capacityError) throw registrationFailure(capacityError)
    const prepared = { ...createData, gameId, teamId }
    if (game.status === 'started' && game.type !== 'story' && game.taskDistributionMode === 'random') {
      const tasksCount = game.tasks?.length || 0
      const gameTemplate = normalizeStoredTaskDistributionTemplate(game.taskDistributionTemplate)
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
  }

  const registerOnDate = () => withGameRegistrationLock({ db, gameId, stageId }, register)
  return stageId ? withGameStageRegistrationLock({ db, stageId }, registerOnDate) : registerOnDate()
}
