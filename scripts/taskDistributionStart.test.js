import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import * as distribution from '../helpers/taskDistribution.js'
import buildGameStartProgressUpdate from '../server/buildGameStartProgressUpdate.js'
import * as registration from '../helpers/gameRegistration.js'

const require = createRequire(import.meta.url)
const swc = require('next/dist/build/swc')
await swc.loadBindings()
const load = async (path, dependencies) => {
  const url = new URL(`../${path}`, import.meta.url)
  const { code } = await swc.transform(await readFile(url, 'utf8'), { filename: fileURLToPath(url), jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => dependencies[id] || require(id), module, module.exports)
  return module.exports
}
const wrap = (fn) => ({ __esModule: true, default: fn })
const fixture = async (overrides = {}, rows = [{ _id: 'one', teamId: 'one', taskSequence: [] }]) => {
  const game = { _id: 'game', status: 'active', type: 'classic', individualStart: true, taskDistributionMode: 'random', taskDistributionTemplate: [[0], [1], [2]], tasks: [{}, {}, {}], ...overrides }
  const teams = structuredClone(rows)
  const events = []
  let failWrite = false
  const db = { model: (name) => name === 'Games' ? { findByIdAndUpdate: async (id, update) => { events.push('started'); Object.assign(game, update); return game } } : name === 'GamesTeams' ? {
    find: async () => structuredClone(teams),
    findByIdAndUpdate: async (id, update) => {
      if (update.$set?.taskSequence && (failWrite === true || failWrite === id)) throw new Error('write failed')
      events.push(update.$set?.taskSequence ? 'sequence' : 'progress')
      const team = teams.find((row) => row._id === id)
      Object.assign(team, update.$set || update)
      return structuredClone(team)
    },
  } : name === 'Teams' ? { find: () => ({ select: () => ({ lean: async () => [{ _id: 'one', name: 'Искатели' }] }) }) } : { find: async () => [], updateMany: async () => {} } }
  const { default: start } = await load('server/gameStart.js', {
    'telegram/func/check': wrap(() => null), 'telegram/func/getGame': wrap(async () => game),
    'telegram/func/formatGameName': wrap(() => 'test'), 'telegram/sendMessage': wrap(() => {}),
    '@helpers/isGameHaveErrors': { getGameValidationErrors: () => [] },
    '@helpers/taskDistribution': distribution, '@helpers/gameRegistration': registration,
    '@server/buildGameStartProgressUpdate': wrap(buildGameStartProgressUpdate),
    '@server/storyEngine': { buildInitialStoryProgress: () => ({}) },
    '@server/applyPrequelStoryEffects': wrap(() => ({ progress: {} })),
    '@helpers/normalizePrequel': { getGamePrequels: () => [], getGameTeamPrequelProgresses: () => [] },
    // Старт выполняется под блокировкой игры (server/withGameTeamsLocked.js).
    // Заглушка передаёт тот же набор данных, что и настоящая блокировка.
    './withGameTeamsLocked.js': wrap(async ({ db: lockedDb }, handler) => handler({
      game,
      teams,
      Games: lockedDb.model('Games'),
      teamModel: () => lockedDb.model('GamesTeams'),
      assertHeld: async () => {},
    })),
  })
  return { game, teams, events, db, fail: (value = true) => { failWrite = value }, invoke: start, start: () => start({ jsonCommand: { gameId: 'game', confirm: true }, db }) }
}
for (const type of ['classic', 'photo']) test(`${type}: отсутствующий маршрут записан до started и сброса прогресса`, async () => {
  const state = await fixture({ type })
  assert.notEqual((await state.start()).success, false)
  assert.deepEqual(state.teams[0].taskSequence, [0, 1, 2])
  // Порядок: маршруты сохраняются до статуса started, прогресс готовится под блокировкой.
  assert.deepEqual(state.events, ['sequence', 'progress', 'started'])
  assert.equal(state.teams[0].taskSequenceSource, 'game_template')
  assert.ok(state.teams[0].taskSequenceGeneratedAt instanceof Date)
})
test('реальный старт блокирует устаревший маршрут до любых записей с названием команды', async () => {
  const state = await fixture({}, [{ _id: 'one', teamId: 'one', taskSequence: [2, 0, 1] }, { _id: 'two' }])
  const result = await state.start()
  assert.equal(result.success, false)
  assert.match(result.errors.join(';'), /Искатели.*шаблон.*Распределите/)
  assert.deepEqual(state.events, [])
  assert.deepEqual(state.teams[0].taskSequence, [2, 0, 1])
})

test('общий старт ставит время только первому исходному заданию актуального маршрута', async () => {
  const state = await fixture({ individualStart: false }, [{ _id: 'one', teamId: 'one', taskDistributionTemplate: [[2], [1], [0]] }])
  await state.start()
  assert.deepEqual(state.teams[0].taskSequence, [2, 1, 0])
  assert.equal(state.teams[0].startTime[0], null)
  assert.equal(state.teams[0].startTime[1], null)
  assert.ok(state.teams[0].startTime[2] instanceof Date)
})

test('валидные сохранённые маршруты любого источника не меняются при повторном старте', async () => {
  for (const source of ['manual', 'team_template', 'game_template', undefined]) {
    const row = { _id: 'one', teamId: 'one', taskSequence: [2, 0, 1], taskSequenceSource: source, taskSequenceGeneratedAt: new Date(1) }
    const state = await fixture({ taskDistributionTemplate: [[0, 1, 2]] }, [row])
    assert.notEqual((await state.start()).success, false)
    assert.notEqual((await state.start()).success, false)
    for (const key of ['taskSequence', 'taskSequenceSource', 'taskSequenceGeneratedAt']) assert.deepEqual(state.teams[0][key], row[key])
    assert.ok(!state.events.includes('sequence'))
  }
})
test('индивидуальный шаблон имеет приоритет над общим', async () => {
  const state = await fixture({}, [{ _id: 'one', teamId: 'one', taskDistributionTemplate: [[2], [1], [0]] }, { _id: 'two', teamId: 'two' }])
  await state.start()
  assert.deepEqual(state.teams.map((row) => row.taskSequence), [[2, 1, 0], [0, 1, 2]])
  assert.equal(state.teams[0].taskSequenceSource, 'team_template')
})
test('невалидные шаблоны блокируют старт до любых записей, без fallback', async () => {
  for (const template of [[[0], [0]], [[0, 1, 2, null]], 'invalid', [[]]]) {
    for (const individual of [true, false]) {
      const state = await fixture(individual ? {} : { taskDistributionTemplate: template }, [{ _id: 'one' }, { _id: 'two', taskSequence: [2, 0, 1], ...(individual ? { taskDistributionTemplate: template } : {}) }])
      assert.equal((await state.start()).success, false)
      assert.deepEqual(state.events, [])
    }
  }
})
test('повреждённый непустой маршрут блокирует старт и не перетасовывается', async () => {
  const state = await fixture({}, [{ _id: 'one' }, { _id: 'two', taskSequence: [0, 0, 2] }])
  assert.equal((await state.start()).success, false)
  assert.deepEqual(state.events, [])
  assert.deepEqual(state.teams[1].taskSequence, [0, 0, 2])
})
test('ошибка сохранения маршрута не переводит игру в started', async () => {
  const state = await fixture(); state.fail()
  await assert.rejects(state.start(), /write failed/)
  assert.ok(!state.events.includes('started'))
})
test('повтор после частичной ошибки записи сохраняет уже подготовленный маршрут и его дату', async () => {
  const state = await fixture({ taskDistributionTemplate: [[0, 1, 2]] }, [{ _id: 'one' }, { _id: 'two' }])
  state.fail('two')
  await assert.rejects(state.start(), /write failed/)
  assert.ok(!state.events.includes('started'))
  const first = structuredClone(state.teams[0])
  state.fail(false)
  await state.start()
  assert.deepEqual(state.teams[0].taskSequence, first.taskSequence)
  assert.deepEqual(state.teams[0].taskSequenceGeneratedAt, first.taskSequenceGeneratedAt)
  assert.equal(state.game.status, 'started')
  assert.equal(state.events.filter((event) => event === 'sequence').length, 2)
})

test('невалидный явно заданный шаблон блокирует старт даже с корректным сохранённым маршрутом', async () => {
  for (const individual of [true, false]) {
    const state = await fixture(individual ? {} : { taskDistributionTemplate: [[0], [0]] }, [{ _id: 'one', taskSequence: [2, 1, 0], ...(individual ? { taskDistributionTemplate: 'invalid' } : {}) }])
    assert.equal((await state.start()).success, false)
    assert.deepEqual(state.events, [])
  }
})

test('web POST кабинета через location POST вызывает реальный обновлённый gameStart', async () => {
  const state = await fixture()
  const model = state.db.model
  const query = (value) => ({ select: () => query(value), lean: async () => value })
  // Сам start читает команды через тот же db; возвращаем await-able query.
  state.db.model = (name) => name === 'GamesTeams' ? { ...model(name), find: () => ({ ...query([]), then: (resolve) => resolve(structuredClone(state.teams)) }) } : name === 'Games' ? { ...model(name), findById: () => query(state.game) } : model(name)
  const location = await load('app/api/[location]/games/start/[id]/route.js', {
    '@server/pwaNotifications': { broadcastNotificationToUsers: async () => {} },
    '@utils/dbConnectGlobal': wrap(async () => state.db),
    '@helpers/idAndDate': await import('../helpers/idAndDate.js'),
    '@server/gameHistory/gameManageAccess': { canManageGame: () => true },
    '@server/gameStart': wrap(state.invoke),
    '@app/api/_lib/runLocationLegacyHandler': { runLocationLegacyHandler: async ({ request, handler, requireAuth }) => {
      assert.equal(requireAuth, true)
      let body, status
      const response = { status: (value) => { status = value; return response }, json: (value) => { body = value; return response } }
      await handler(request, response)
      return { body, status }
    } },
  })
  const cabinet = await load('app/api/cabinet/games/[gameId]/start/route.js', {
    'next/server': { NextResponse: { json: (body) => body } },
    '@app/api/cabinet/_lib/proxyToLocationGameRoute': { proxyToLocationGameRoute: async ({ gameId, targetPath, method }) => {
      assert.equal(targetPath, '/api/:location/games/start/:gameId')
      assert.equal(method, 'POST')
      return location.POST({ query: { id: gameId, location: 'test' }, session: { user: { role: 'admin' } } }, { params: {} })
    } },
  })
  const result = await cabinet.POST({ method: 'POST' }, { params: Promise.resolve({ gameId: 'game' }) })
  assert.equal(result.status, 200)
  assert.deepEqual(state.teams[0].taskSequence, [0, 1, 2])
  // Порядок: маршруты сохраняются до статуса started, прогресс готовится под блокировкой.
  assert.deepEqual(state.events, ['sequence', 'progress', 'started'])
})

test('batch API сохраняет маршруты и считает только подтверждённые записи; права не расширены', async () => {
  let role = 'admin'
  let missing = false
  const game = { _id: 'game', taskDistributionMode: 'random', taskDistributionTemplate: [[0], [1], [2]] , tasks: [{}, {}, {}] }
  const teams = [{ _id: 'one', teamId: 'one' }, { _id: 'two', teamId: 'two', taskDistributionTemplate: [[2], [1], [0]], taskSequence: [0, 1, 2], taskSequenceSource: 'team_template', startTime: [new Date(1)] }]
  const query = (value) => ({ select: () => query(value), lean: async () => value })
  const db = { model: (name) => name === 'Games' ? { findOne: () => query(game) } : { find: () => query(teams), findByIdAndUpdate: async (id, update) => { if (missing && id === 'two') return null; const row = teams.find((team) => team._id === id); Object.assign(row, update.$set); return row } } }
  const api = await load('app/api/cabinet/admin/task-distribution/route.js', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    'next-auth': { getServerSession: async () => ({ user: { role } }) },
    '@server/auth/authOptions': { authOptions: {} }, '@utils/dbConnectGlobal': wrap(async () => db),
    '@helpers/gameAssignmentAccess': await import('../helpers/gameAssignmentAccess.js'),
    '@helpers/idAndDate': await import('../helpers/idAndDate.js'), '@helpers/taskDistribution': distribution,
    // Маршруты обновляются под блокировкой игры (server/withGameTeamsLocked.js).
    '@server/withGameTeamsLocked': wrap(async ({ db: lockedDb }, handler) => handler({
      game,
      teams,
      teamModel: () => lockedDb.model('GamesTeams'),
      assertHeld: async () => {},
    })),
  })
  const request = { json: async () => ({ gameId: 'game' }) }
  for (const denied of ['client', 'agent', 'moder']) { role = denied; assert.equal((await api.POST(request)).status, 403) }
  role = 'admin'
  const result = await api.POST(request)
  assert.equal(result.status, 200)
  assert.equal(result.body.data.teamsUpdated, 2)
  assert.deepEqual(teams.map((team) => team.taskSequence), [[0, 1, 2], [0, 2, 1]])
  const manual = { _id: 'manual', teamId: 'manual', taskSequence: [2, 1, 0], taskSequenceSource: 'linear', taskSequenceGeneratedAt: new Date(1) }
  teams.push(structuredClone(manual))
  assert.equal((await api.POST(request)).body.data.teamsUpdated, 2)
  assert.deepEqual(teams[2], manual)
  assert.equal((await api.POST({ json: async () => ({ gameId: 'game', teamId: 'manual' }) })).body.data.teamsUpdated, 0)
  assert.deepEqual(teams[2], manual)
  missing = true
  assert.equal((await api.POST(request)).status, 500)
})

for (const overrides of [{ taskDistributionMode: 'linear' }, { type: 'story' }]) test(`${JSON.stringify(overrides)}: маршруты не генерируются`, async () => {
  const state = await fixture(overrides)
  assert.notEqual((await state.start()).success, false)
  assert.deepEqual(state.teams[0].taskSequence, [])
  assert.ok(!state.events.includes('sequence'))
})
