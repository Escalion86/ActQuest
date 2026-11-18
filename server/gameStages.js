import { canManageGame } from '@server/gameHistory/gameManageAccess'
import { toStringId } from '../helpers/idAndDate.js'
import buildGameStageResult, {
  GameStageError,
  assertGameStageCompatibility,
  compareGameStageHintRules,
  compareGameStageTasks,
  stageRuleFields,
} from './buildGameStageResult.js'
import { withGameRegistrationLock, withGameStageRegistrationLock } from './registerGameTeam.js'

const copiedFields = [
  ...stageRuleFields,
  'seasonName', 'description', 'descriptionRich', 'descriptionMedia', 'prestartDescriptionRich',
  'image', 'taskTheme', 'useCustomTaskPublicTitles', 'isPrivate', 'orderType', 'startingPlace',
  'finishingPlace', 'showFinishingPlace', 'maxTeams', 'registrationOpen', 'registeredTeamsVisibility',
  'allowJoinAfterStart', 'paymentMode', 'prices', 'showEnterButton', 'showTasks', 'showTasksAudience',
  'showTasksCountInGame', 'showResultAudience', 'hideResult', 'recordsVisibility', 'recordsShowNames',
  'showCreator', 'moderators', 'agents', 'agentNotifications', 'creatorUserId', 'creatorTelegramId',
]

export const isGameStageId = (value) => typeof value === 'string' && /^[\da-f]{24}$/i.test(value)

const assertCanManageGames = (session, games) => {
  if (games.some((game) => !canManageGame({ session, game }))) {
    throw new GameStageError('Недостаточно прав для управления всеми проведениями.', 403)
  }
}

const createStage = (db, source, fallbacks) => db.model('GameStages').create({
  name: source.name,
  location: source.location,
  seasonId: source.seasonId,
  seasonName: source.seasonName,
  dateStart: source.dateStart,
  participationMode: source.participationMode,
  isRated: source.isRated,
  fallbackGameIds: fallbacks.filter((game) => game.status === 'closed').map((game) => game._id),
})

const plainGame = (game) => game.toObject({ flattenMaps: true })

const readStageGames = async (db, stageId) =>
  (await db.model('Games').find({ stageId }).sort({ dateStart: 1, _id: 1 })).map(plainGame)

const stageDateOrder = (first, second) =>
  Number(first.dateStart) - Number(second.dateStart) || String(first._id).localeCompare(String(second._id))

const buildNewDate = ({ source, stageId, dateStart, maxTeams }) => ({
  ...Object.fromEntries(copiedFields.map((field) => [field, source[field]])),
  name: source.name,
  stageId,
  status: 'active',
  hidden: true,
  ...(dateStart ? { dateStart } : {}),
  ...(maxTeams !== undefined ? { maxTeams } : {}),
})

export const addGameStageDate = async ({ db, session, sourceGameId, dateStart, maxTeams }) => {
  if (!isGameStageId(sourceGameId)) throw new GameStageError('Выберите исходную игру.', 400)
  const Games = db.model('Games')
  const source = await Games.findById(sourceGameId).lean()
  if (!source) throw new GameStageError('Исходная игра не найдена.', 404)
  const addDate = async (registeredGame, stage) => {
    const locked = plainGame(Games.hydrate(registeredGame))
    assertCanManageGames(session, [locked])
    assertGameStageCompatibility([locked])
    if (locked.status === 'canceled') throw new GameStageError('Выберите действующее проведение.')
    if (stage?.result) {
      throw new GameStageError('Общий результат этого этапа уже опубликован.')
    }
    if (stage) return Games.create(buildNewDate({ source: locked, stageId: stage._id, dateStart, maxTeams }))

    const newStage = await createStage(db, locked, [locked])
    const newDate = new Games(buildNewDate({ source: locked, stageId: newStage._id, dateStart, maxTeams }))
    try {
      await newDate.save()
      const linked = await Games.updateOne({ _id: locked._id, stageId: null }, { stageId: newStage._id })
      if (!linked.modifiedCount) throw new GameStageError('Связь игры изменилась. Повторите действие.')
      return newDate
    } catch (error) {
      await Games.updateOne({ _id: locked._id, stageId: newStage._id }, { $unset: { stageId: 1 } })
      await Games.deleteOne({ _id: newDate._id, stageId: newStage._id })
      await db.model('GameStages').deleteOne({ _id: newStage._id })
      throw error
    }
  }

  const withSource = (stage) => withGameRegistrationLock(
    { db, gameId: sourceGameId, stageId: source.stageId ?? null },
    (locked) => addDate(locked, stage),
  )
  return source.stageId
    ? withGameStageRegistrationLock({ db, stageId: source.stageId }, withSource)
    : withSource(null)
}

const storeStageResult = async ({ db, stage, games, result }) => {
  const firstDate = games.find((game) => game.status !== 'canceled')?.dateStart ?? stage.dateStart
  return db.model('GameStages').findByIdAndUpdate(stage._id, {
    dateStart: firstDate,
    fallbackGameIds: [],
    result,
    publishedAt: result ? (stage.publishedAt ?? new Date()) : null,
  }, { returnDocument: 'after' }).lean()
}

export const publishGameStage = ({ db, stageId, session }) =>
  withGameStageRegistrationLock({ db, stageId }, async (stage) => {
    const games = await readStageGames(db, stageId)
    assertCanManageGames(session, games)
    if (games.length < 2) throw new GameStageError('Для общего зачёта нужны как минимум два проведения.')
    const result = await buildGameStageResult(games)
    const published = await storeStageResult({ db, stage, games, result })
    return { published, affectedGames: [...games, stage] }
  })

export const refreshPublishedGameStage = async ({ db, stageId }) => {
  const published = await db.model('GameStages').exists({ _id: stageId, result: { $ne: null } })
  if (!published) return null

  return withGameStageRegistrationLock({ db, stageId }, async (stage) => {
    if (!stage.result) return null
    const games = await readStageGames(db, stageId)
    let result = null
    try {
      result = await buildGameStageResult(games)
    } catch (error) {
      if (!(error instanceof GameStageError)) throw error
    }
    await storeStageResult({ db, stage, games, result })
    return stage
  })
}

export const combineClosedGames = async ({ db, session, gameIds, preview }) => {
  if (!Array.isArray(gameIds) || gameIds.length < 2 || gameIds.some((id) => !isGameStageId(id))) {
    throw new GameStageError('Выберите как минимум два проведения.', 400)
  }
  const uniqueIds = [...new Set(gameIds.map((id) => id.toLowerCase()))].sort()
  if (uniqueIds.length !== gameIds.length) throw new GameStageError('Выберите разные проведения.', 400)

  const Games = db.model('Games')
  const selectedGames = (await Games.find({ _id: { $in: uniqueIds } }).sort({ dateStart: 1, _id: 1 })).map(plainGame)
  if (selectedGames.length !== uniqueIds.length) throw new GameStageError('Одно из проведений не найдено.', 404)
  assertCanManageGames(session, selectedGames)
  const validate = async (games) => {
    assertCanManageGames(session, games)
    if (games.some((game) => game.stageId || game.status !== 'closed')) {
      throw new GameStageError('Выберите закрытые игры, которые ещё не входят в общий зачёт.')
    }
    return buildGameStageResult(games)
  }
  if (preview) {
    const result = await validate(selectedGames)
    return {
      name: selectedGames[0].name,
      teams: result.rows,
      teamsCount: Object.keys(result.teamsPlaces).length,
      gameIds: uniqueIds,
      taskDifferences: compareGameStageTasks(selectedGames),
      ruleDifferences: compareGameStageHintRules(selectedGames),
    }
  }

  const stageId = selectedGames[0].stageId
  if (stageId && selectedGames.every((game) => toStringId(game.stageId) === toStringId(stageId))) {
    const stage = await db.model('GameStages').findById(stageId).lean()
    if (stage?.result && stage.result.sourceGameIds?.length === uniqueIds.length &&
      uniqueIds.every((id) => stage.result.sourceGameIds.includes(id))) {
      return { published: stage, affectedGames: selectedGames }
    }
  }

  const link = async (games) => {
    games.sort(stageDateOrder)
    const result = await validate(games)
    const stage = await createStage(db, games[0], games)
    try {
      const updated = await Games.updateMany({ _id: { $in: uniqueIds }, stageId: null }, { stageId: stage._id })
      if (updated.modifiedCount !== uniqueIds.length) throw new GameStageError('Связь проведений изменилась. Повторите действие.')
      const published = await storeStageResult({ db, stage, games, result })
      return { published, affectedGames: games }
    } catch (error) {
      await Games.updateMany({ stageId: stage._id }, { $unset: { stageId: 1 } })
      await db.model('GameStages').deleteOne({ _id: stage._id })
      throw error
    }
  }
  const lockGames = (games) => games.length === uniqueIds.length
    ? link(games)
    : withGameRegistrationLock({ db, gameId: uniqueIds[games.length] }, (game) => lockGames([...games, plainGame(Games.hydrate(game))]))

  return lockGames([])
}
