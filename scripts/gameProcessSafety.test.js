import test from 'node:test'
import assert from 'node:assert/strict'
import { loadServerUnit } from './helpers/loadServerUnit.mjs'
import { memoryGameDb } from './helpers/memoryGameDb.mjs'
import * as locks from '../server/gameProcessLock.js'
import withGameTeamsLocked from '../server/withGameTeamsLocked.js'
import * as distribution from '../helpers/taskDistribution.js'
import * as rules from '../helpers/classicGameRules.js'
import buildGameStartProgressUpdate from '../server/buildGameStartProgressUpdate.js'
import buildGameResultComputed from '../server/buildGameResultComputed.js'
import updateParticipantsRatings from '../server/updateParticipantsRatings.js'
import { toStringId } from '../helpers/idAndDate.js'
import { buildCompletedParticipationStats } from '../server/buildCompletedParticipationStats.js'
import * as prequels from '../helpers/normalizePrequel.js'
import applyPrequelSubmission from '../server/applyPrequelSubmission.js'
import resolveTeamMembershipForIdentity from '../helpers/resolveTeamMembershipForIdentity.js'

const quiet = { info() {}, error() {}, log() {} }
const distributionApi = (db) => loadServerUnit('app/api/cabinet/admin/task-distribution/route.js', {
  ...distribution, withGameTeamsLocked, toStringId, console: quiet,
  buildTaskSequenceFromTemplate: () => [0, 1, 2],
  authOptions: {}, getServerSession: async () => ({ user: { userId: 'admin', role: 'admin' } }),
  canAccessGameAsModerator: () => true, dbConnectGlobal: async () => db,
  NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) },
}, ['POST']).POST
const { normalizePrequelProgressForApi } = loadServerUnit('server/normalizePrequelProgress.js', prequels, ['normalizePrequelProgressForApi'])
const fixture = (status = 'started') => memoryGameDb({
  Games: [{ _id: 'game', status, type: 'classic', tasks: [{ codes: ['a'] }, { codes: ['b'] }], taskDuration: 3600, breakDuration: 300 }],
  GamesTeams: [{ _id: 'registration', gameId: 'game', teamId: 'team', activeNum: 0,
    taskSequence: [1, 0], startTime: [null, new Date(Date.now() - 600_000)], endTime: [null, new Date(Date.now() - 400_000)] }],
  Teams: [{ _id: 'team', name: 'Команда' }],
  TeamsUsers: [{ userId: 'user', teamId: 'team', role: 'captain' }],
})
const { computeTaskHtml } = loadServerUnit('server/getTeamGameTaskState.js', {
  ...locks, ...distribution, ...rules,
  normalizeTaskTheme: () => 'default', getGameProcessFinishingPlace: () => '',
  sanitize: String, taskText: () => 'Задание', buildTaskDisplayContent: () => ({}),
}, ['computeTaskHtml'])
const { buildGameResultSnapshots } = loadServerUnit('server/buildGameResultSnapshots.js', {
  toStringId, hasClassicVariants: () => false,
}, ['buildGameResultSnapshots'])
const shared = {
  console: quiet, check: () => null, formatGameName: () => 'Игра',
  getGame: async (id, db) => db.model('Games').findById(id).lean(),
  sendMessage: async () => {}, withGameTeamsLocked,
}
const { gameStart } = loadServerUnit('server/gameStart.js', {
  ...shared, ...distribution, buildGameStartProgressUpdate,
  getGameValidationErrors: () => [], isIndividualGameStart: (game) => !!game.individualStart,
}, ['gameStart'])
const { gameStop } = loadServerUnit('telegram/commands/gameStop.js', {
  ...shared, buildGameResultSnapshots,
}, ['gameStop'])

test('СТОП на перерыве сохраняет фактическое время выполненного задания при любом маршруте', async () => {
  for (const sequence of [[0, 1], [1, 0]]) {
    const first = sequence[0]
    const startTime = [null, null], endTime = [null, null]
    startTime[first] = new Date('2026-10-24T12:00:00Z')
    endTime[first] = new Date('2026-10-24T12:05:00Z')
    const result = await buildGameResultComputed({ game: {
      type: 'classic', taskDuration: 3600, taskFailurePenalty: 60, tasks: [{}, {}],
      result: { teams: [{ _id: 'team' }], teamsUsers: [{ userId: 'user', teamId: 'team' }],
        gameTeams: [{ teamId: 'team', activeNum: 0, taskSequence: sequence, startTime, endTime }] },
    } })
    const team = result.computed.teams[0]
    assert.equal(team.taskResults[first].normalizedSeconds, 300)
    assert.equal(team.taskResults[first].status, 'completed')
    assert.equal(team.taskResults[first].penaltySeconds, 0)
    assert.equal(team.baseSeconds, 3900)
  }
})

test('обновление завершённой/закрытой игры не пишет прогресс', async () => {
  for (const status of ['finished', 'closed']) {
    const db = fixture(status), model = db.model('GamesTeams')
    const original = structuredClone(model.docs[0])
    await computeTaskHtml({ game: db.model('Games').docs[0], gameTeam: original,
      gamesTeamsModel: model, isGameStarted: false, isGameFinished: true })
    assert.deepEqual(model.docs[0], original)
    assert.equal(model.writes.length, 0)
  }
})

test('два обновления экрана выполняют один переход с одинаковым временем старта', async () => {
  const db = fixture(), model = db.model('GamesTeams')
  const oldTeam = structuredClone(model.docs[0])
  const options = { game: db.model('Games').docs[0], gameTeam: oldTeam,
    gamesTeamsModel: model, isGameStarted: true, isGameFinished: false }
  await Promise.all([computeTaskHtml(options), computeTaskHtml(options)])
  assert.equal(model.docs[0].activeNum, 1)
  assert.equal(model.docs[0].startTime[0].getTime(), oldTeam.endTime[1].getTime() + 300000)
  assert.equal(model.writes.filter((item) => item.update.activeNum === 1).length, 1)
})

test('истёкший владелец блокировки не записывает результат', async () => {
  const model = fixture().model('GamesTeams')
  const lock = await locks.acquireGameProcessLock({ GamesTeams: model, teamId: 'registration' })
  model.docs[0].gameProcessLock.expiresAt = new Date(0)
  await assert.rejects(async () => await locks.guardGameProgressModel(model, lock).findByIdAndUpdate('registration', { activeNum: 9 }), { statusCode: 409 })
  assert.equal(model.docs[0].activeNum, 0)
})

test('отложенная запись проверяет срок блокировки при выполнении, а не при создании запроса', async () => {
  const model = fixture().model('GamesTeams')
  const lock = await locks.acquireGameProcessLock({ GamesTeams: model, teamId: 'registration' })
  model.docs[0].gameProcessLock.expiresAt = new Date(Date.now() + 30)
  const pending = locks.guardGameProgressModel(model, lock).findByIdAndUpdate('registration', { activeNum: 9 })
  await new Promise((resolve) => setTimeout(resolve, 50))
  await assert.rejects(async () => await pending, { statusCode: 409 })
  assert.equal(model.docs[0].activeNum, 0)
})

test('перераспределение ждёт переход команды и сохраняет уже начатую часть маршрута', async () => {
  const db = fixture(), model = db.model('GamesTeams')
  Object.assign(db.model('Games').docs[0], { id: 'game', tasks: [{}, {}, {}], taskDistributionMode: 'random', taskDistributionTemplate: [[0, 1, 2]] })
  Object.assign(model.docs[0], { taskSequence: [2, 1, 0], startTime: [null, null, new Date()], endTime: [] })
  const lock = await locks.acquireGameProcessLock({ GamesTeams: model, teamId: 'registration' })
  const pending = distributionApi(db)({ json: async () => ({ gameId: 'game' }) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  await locks.guardGameProgressModel(model, lock).findByIdAndUpdate('registration', {
    activeNum: 1, startTime: [null, new Date(), model.docs[0].startTime[2]],
  })
  await locks.releaseGameProcessLock({ GamesTeams: model, teamId: 'registration', token: lock.token })
  const result = await pending
  assert.equal(result.status, 200, JSON.stringify(result.data))
  assert.deepEqual(model.docs[0].taskSequence, [2, 1, 0])
})

test('перераспределение не меняет маршрут завершённой игры', async () => {
  for (const status of ['finished', 'closed']) {
    const db = fixture(status)
    db.model('Games').docs[0].id = 'game'
    const result = await distributionApi(db)({ json: async () => ({ gameId: 'game' }) })
    assert.equal(result.status, 409)
    assert.deepEqual(db.model('GamesTeams').docs[0].taskSequence, [1, 0])
  }
})

test('повторный и параллельный старт не сбрасывают уже запущенный прогресс', async () => {
  const db = fixture('active')
  const args = { db, jsonCommand: { gameId: 'game', confirm: true } }
  await Promise.all([gameStart(args), gameStart(args)])
  const game = db.model('Games').docs[0], model = db.model('GamesTeams')
  assert.equal(game.status, 'started')
  assert.equal(model.docs[0].startTime[0], null)
  assert.equal(model.docs[0].startTime[1].getTime(), game.dateStartFact.getTime())
  model.docs[0].findedCodes = [[], ['accepted']]
  const before = JSON.stringify(model.docs[0])
  const result = await gameStart(args)
  assert.equal(result.alreadyStarted, true)
  assert.equal(JSON.stringify(model.docs[0]), before)
})

test('ошибка подготовки команд не публикует started, повторный запуск восстанавливает старт', async () => {
  const db = fixture('active'), model = db.model('GamesTeams')
  model.failUpdate = (_filter, update) => Object.hasOwn(update, 'activeNum')
  const args = { db, jsonCommand: { gameId: 'game', confirm: true } }
  await assert.rejects(gameStart(args), /сбой/)
  assert.equal(db.model('Games').docs[0].status, 'active')
  model.failUpdate = null
  await gameStart(args)
  assert.equal(db.model('Games').docs[0].status, 'started')
})

test('СТОП включает ответ под блокировкой и не переснимает результат при повторе', async () => {
  const db = fixture(), model = db.model('GamesTeams')
  const lock = await locks.acquireGameProcessLock({ GamesTeams: model, teamId: 'registration' })
  const stopping = gameStop({ db, jsonCommand: { gameId: 'game', confirm: true } })
  await locks.guardGameProgressModel(model, lock).findByIdAndUpdate('registration', { findedCodes: [[], ['last']] })
  await locks.releaseGameProcessLock({ GamesTeams: model, teamId: 'registration', token: lock.token })
  await stopping
  const game = db.model('Games').docs[0]
  assert.equal(game.status, 'finished')
  assert.deepEqual(game.result.gameTeams[0].findedCodes, [[], ['last']])
  assert.equal(game.result.gameTeams[0].gameProcessLock, undefined)
  const snapshot = JSON.stringify(game.result)
  model.docs[0].activeNum = 2
  await gameStop({ db, jsonCommand: { gameId: 'game', confirm: true } })
  assert.equal(JSON.stringify(game.result), snapshot)
})

test('запрос со старым started после СТОП не переводит команду дальше', async () => {
  const db = fixture(), model = db.model('GamesTeams')
  const oldGame = structuredClone(db.model('Games').docs[0])
  const oldTeam = structuredClone(model.docs[0])
  await gameStop({ db, jsonCommand: { gameId: 'game', confirm: true } })
  await computeTaskHtml({ game: oldGame, gameTeam: oldTeam, gamesTeamsModel: model,
    isGameStarted: true, isGameFinished: false })
  assert.equal(model.docs[0].activeNum, 0)
})

test('история без userId не делит человека на два рейтинга и не перезаписывает статистику', async () => {
  const game = { _id: 'g', result: { teamsUsers: [{ userTelegramId: 123, teamId: 'team' }] } }
  const db = { model() { throw new Error('Запись не должна выполняться') } }
  await assert.rejects(updateParticipantsRatings({ db, game }), { code: 'PARTICIPANT_USER_ID_REQUIRED' })
  assert.throws(() => buildCompletedParticipationStats([game]), { code: 'PARTICIPANT_USER_ID_REQUIRED' })
})

const prequelApi = (db, userId = 'user', telegramId = 123) => loadServerUnit('app/api/webapp/game-prequel/route.js', {
  ...locks, ...prequels, resolveTeamMembershipForIdentity, applyPrequelSubmission,
  normalizePrequelProgressForApi, authOptions: {},
  getServerSession: async () => ({ user: { userId, telegramId } }),
  dbConnectGlobal: async () => db,
  NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) },
}, ['POST']).POST

test('два параллельных кода приквела сохраняют оба результата', async () => {
  const db = fixture('active')
  db.model('Games').docs[0].prequel = {
    enabled: true, mode: 'multi_hit',
    openAt: '2026-01-01T00:00:00Z', description: 'Найдите коды',
    bonusCodes: [{ id: 'a', code: 'ONE', value: 10 }, { id: 'b', code: 'TWO', value: 20 }],
  }
  const post = prequelApi(db)
  const results = await Promise.all(['ONE', 'TWO'].map((code) => post({
    json: async () => ({ gameTeamId: 'registration', code }),
  })))
  assert.deepEqual(results.map((item) => item.status), [200, 200])
  assert.equal(db.model('GamesTeams').docs[0].prequelProgresses[0].foundBonusCodes.length, 2)
})

test('приквел не даёт права капитана по совпавшему Telegram ID', async () => {
  const db = fixture('active')
  db.model('TeamsUsers').docs[0].userTelegramId = 123
  const response = await prequelApi(db, 'stranger')({ json: async () => ({ gameTeamId: 'registration', code: 'ONE' }) })
  assert.equal(response.status, 403)
  assert.equal(db.model('GamesTeams').writes.length, 0)
})
