import { toStringId } from '../helpers/idAndDate.js'
import { calculateRatingGameScore } from '../helpers/ratingV2.js'
import { normalizeClueEarlyAccessFrom } from '../helpers/clueEarlyAccess.js'
import { CLOSED_GAME_IMMUTABLE_FIELD_LABELS } from '../helpers/closedGameUpdateProtection.js'
import { getGamePrequels, resolveRequiredPrequelMainCodesCount } from '../helpers/normalizePrequel.js'
import buildGameResultComputed from './buildGameResultComputed.js'

export class GameStageError extends Error {
  constructor(message, status = 409) {
    super(message)
    this.status = status
  }
}

export const stageRuleFields = [
  'type', 'location', 'seasonId', 'isRated', 'participationMode', 'individualStart',
  'tasks', 'taskDistributionMode', 'taskDistributionTemplate', 'taskDuration',
  'cluesDuration', 'clueIntervals', 'clueEarlyPenalty', 'clueEarlyAccessMode',
  'allowCaptainForceClue', 'clueEarlyAccessFrom', 'allowCaptainFailTask',
  'allowCaptainFinishBreak', 'breakDuration', 'taskFailurePenalty', 'manyCodesPenalty',
  'classicItemsAndVariantsEnabled', 'classicItems', 'classicTriggers', 'prequel',
  'prequels', 'maxTeamPlayers',
]

const sharedStageRuleFields = stageRuleFields.filter((field) =>
  !['tasks', 'prequel', 'prequels', 'clueEarlyAccessFrom'].includes(field),
)
const stageRuleLabels = {
  ...CLOSED_GAME_IMMUTABLE_FIELD_LABELS,
  location: 'город',
  seasonId: 'сезон',
  isRated: 'учёт в рейтинге',
  participationMode: 'режим участия',
  classicItemsAndVariantsEnabled: 'режим предметов и вариантов',
  classicItems: 'предметы',
  classicTriggers: 'триггеры',
  prequels: 'правила приквела',
  maxTeamPlayers: 'максимальный размер команды',
}

// У копий могут отличаться служебные ID вложенных документов и даты открытия приквела.
const normalizeRuleValue = (value, section, parentKey) => {
  if (Array.isArray(value)) return value.map((item) => normalizeRuleValue(item, section, parentKey))
  if (value == null || typeof value !== 'object') return value ?? null
  if (value instanceof Date) return value.toISOString()
  if (value._bsontype === 'ObjectId') return toStringId(value)
  return Object.fromEntries(
    Object.keys(value).sort()
      .filter((key) => key !== '_id' && key !== 'openAt' && key !== 'agentUserIds')
      .filter((key) => !(section === 'task' && !parentKey && key === 'stageKey'))
      .filter((key) => !(key === 'id' && (section === 'prequel' || (section === 'task' && parentKey?.endsWith('Media')))))
      .map((key) => [key, normalizeRuleValue(value[key], section, key)]),
  )
}

export const equalGameStageRule = (field, first, second) => {
  if (field === 'type') return (first || 'classic') === (second || 'classic')
  if (field === 'participationMode') return (first || 'team') === (second || 'team')
  if (field === 'isRated') return (first !== false) === (second !== false)
  if (field === 'seasonId') return (toStringId(first) || '') === (toStringId(second) || '')
  return JSON.stringify(normalizeRuleValue(first)) === JSON.stringify(normalizeRuleValue(second))
}

const enabledPrequels = (game) => getGamePrequels(game).filter((prequel) => prequel.enabled)

const prequelScoringRules = (game) => enabledPrequels(game).map((prequel) => ({
  mode: prequel.mode,
  mainCodesCount: prequel.mainCodesCount,
  requiredMainCodesCount: resolveRequiredPrequelMainCodesCount(prequel),
  completionBonus: prequel.completionBonus.value,
  bonusValues: prequel.bonusCodes.map(({ value }) => value),
  penaltyValues: prequel.penaltyCodes.map(({ value }) => value),
  wrongAttemptsLimit: prequel.wrongAttemptsLimit,
  wrongAttemptsPenalty: prequel.wrongAttemptsPenalty,
}))

export const assertGameStageCompatibility = (games) => {
  const [first, ...others] = games
  if (!first || (first.type || 'classic') !== 'classic') {
    throw new GameStageError('Общий зачёт доступен для классических игр.')
  }
  for (const game of others) {
    const differentRules = sharedStageRuleFields.filter((field) => !equalGameStageRule(field, first[field], game[field]))
    if (!equalGameStageRule('prequels', prequelScoringRules(first), prequelScoringRules(game))) {
      differentRules.push('prequels')
    }
    if (differentRules.length > 0) {
      const labels = differentRules.map((field) => `«${stageRuleLabels[field]}»`).join(', ')
      throw new GameStageError(`У проведения «${game.name}» отличаются настройки — ${labels}.`)
    }
  }
}

const taskTitle = (task) => task?.title?.trim() || task?.publicTitle?.trim() || ''

const compareTasksByPosition = (referenceTasks, currentTasks, section) => {
  const tasks = []
  for (let index = 0; index < Math.max(referenceTasks.length, currentTasks.length); index += 1) {
    const original = referenceTasks[index]
    const current = currentTasks[index]
    if (JSON.stringify(normalizeRuleValue(original, section)) === JSON.stringify(normalizeRuleValue(current, section))) continue
    tasks.push({
      ...(section === 'prequel' ? { section } : {}),
      number: index + 1,
      referenceTitle: taskTitle(original),
      title: taskTitle(current),
      kind: !original ? 'added' : !current ? 'removed' : 'changed',
    })
  }
  return tasks
}

export const compareGameStageTasks = (games) => {
  const [reference, ...others] = games
  if (!reference) return []
  const referenceTasks = reference.tasks ?? []
  const referencePrequels = enabledPrequels(reference)

  return others.flatMap((game) => {
    const tasks = [
      ...compareTasksByPosition(referenceTasks, game.tasks ?? [], 'task'),
      ...compareTasksByPosition(referencePrequels, enabledPrequels(game), 'prequel'),
    ]

    if (!tasks.length) return []
    return [{
      gameId: toStringId(game._id),
      gameName: game.name,
      dateStart: game.dateStart,
      referenceGameId: toStringId(reference._id),
      referenceGameName: reference.name,
      referenceDateStart: reference.dateStart,
      tasks,
    }]
  })
}

export const compareGameStageHintRules = (games) => {
  const [reference, ...others] = games
  if (!reference || reference.allowCaptainForceClue === false) return []
  const referenceNumber = normalizeClueEarlyAccessFrom(reference.clueEarlyAccessFrom)

  return others.flatMap((game) => {
    const number = normalizeClueEarlyAccessFrom(game.clueEarlyAccessFrom)
    if (number === referenceNumber) return []
    return [{
      gameId: toStringId(game._id),
      gameName: game.name,
      dateStart: game.dateStart,
      referenceGameName: reference.name,
      referenceDateStart: reference.dateStart,
      field: 'clueEarlyAccessFrom',
      label: 'Досрочное открытие подсказок',
      referenceValue: `с подсказки №${referenceNumber}`,
      value: `с подсказки №${number}`,
    }]
  })
}

const readComputedResult = async (game) => {
  const result = game.result
  if (Array.isArray(result?.teamsUsers) && Array.isArray(result?.computed?.teams) && result.computed.summary?.scoringMode === 'time') {
    return result.computed
  }
  if (!Array.isArray(result?.teams) || !Array.isArray(result?.gameTeams) || !Array.isArray(result?.teamsUsers)) {
    throw new GameStageError(`Для проведения «${game.name}» нужны сохранённые результаты или снимки игры.`)
  }
  const gameTeamIds = new Set(result.gameTeams.map((team) => toStringId(team.teamId)))
  if (result.teams.some((team) => !gameTeamIds.has(toStringId(team._id ?? team.id)))) {
    throw new GameStageError(`Для проведения «${game.name}» сохранён неполный снимок результатов.`)
  }
  return (await buildGameResultComputed({ game })).computed
}

export default async function buildGameStageResult(games) {
  const activeGames = games.filter((game) => game.status !== 'canceled')
  if (!activeGames.length || activeGames.some((game) => game.status !== 'closed')) {
    throw new GameStageError('Сначала закройте все действующие проведения этапа.')
  }
  assertGameStageCompatibility(activeGames)

  const ranked = []
  const outOfCompetition = []
  const knownTeams = new Set()
  const playerGames = new Map()
  const teamsUsers = []
  const computedResults = await Promise.all(activeGames.map(readComputedResult))

  activeGames.forEach((game, index) => {
    const sourceGameId = toStringId(game._id)
    const computed = computedResults[index]
    const currentTeams = new Set()
    for (const team of [...computed.teams, ...(computed.outOfCompetitionTeams ?? [])]) {
      const teamId = toStringId(team.teamId)
      if (!teamId || typeof team.finalSeconds !== 'number' || !Number.isFinite(team.finalSeconds)) {
        throw new GameStageError(`Для проведения «${game.name}» отсутствует итоговое время команды.`)
      }
      if (knownTeams.has(teamId)) {
        throw new GameStageError(`Команда «${team.teamName}» встречается в нескольких результатах этапа.`)
      }
      knownTeams.add(teamId)
      currentTeams.add(teamId)
      const row = { teamId, teamName: team.teamName, finalSeconds: team.finalSeconds, sourceGameId }
      if (team.outOfCompetition) outOfCompetition.push({ ...row, place: null })
      else ranked.push(row)
    }
    for (const membership of game.result?.teamsUsers ?? []) {
      const teamId = toStringId(membership.teamId)
      if (!currentTeams.has(teamId)) continue
      const userId = toStringId(membership.userId)
      if (!userId && game.isRated !== false && membership.userTelegramId) {
        throw new GameStageError(`В протоколе «${game.name}» есть участник без глобального ID.`)
      }
      if (userId && playerGames.has(userId) && playerGames.get(userId) !== sourceGameId) {
        throw new GameStageError(`Один из игроков участвовал в нескольких проведениях этапа (${userId}).`)
      }
      if (userId) playerGames.set(userId, sourceGameId)
      teamsUsers.push({ teamId, userId, userTelegramId: membership.userTelegramId })
    }
  })

  ranked.sort((first, second) =>
    first.finalSeconds - second.finalSeconds ||
    (first.teamName || '').localeCompare(second.teamName || '', 'ru') ||
    first.teamId.localeCompare(second.teamId),
  )
  const teams = ranked.map((row, index) => ({
    ...row,
    place: index + 1,
    score: activeGames[0].isRated === false ? null : calculateRatingGameScore({
      place: index + 1,
      participantsCount: ranked.length,
    }),
  }))

  return {
    teams: [...teams, ...outOfCompetition].map((row) => ({ _id: row.teamId, name: row.teamName })),
    teamsUsers,
    teamsPlaces: Object.fromEntries(teams.map((row) => [row.teamId, row.place])),
    rows: [...teams, ...outOfCompetition],
    sourceGameIds: activeGames.map((game) => toStringId(game._id)),
  }
}
