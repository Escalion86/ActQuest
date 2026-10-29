import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import * as validation from '../helpers/isGameHaveErrors.js'
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
const fixture = async (overrides = {}, rows = [{ _id: 'registration', teamId: 'team', taskSequence: [2, 0, 1] }]) => {
  const game = { _id: 'game', type: 'photo', location: 'test', startingPlace: 'start', finishingPlace: 'finish', allowCaptainForceClue: false, cluesDuration: 0, tasks: [0, 1, 2].map((i) => ({ title: String(i), task: 'filled', codes: ['code'] })), taskDistributionMode: 'random', taskDistributionTemplate: [[0, 1], [2]], ...overrides }
  const before = structuredClone(rows)
  const query = (value) => ({ select: (projection) => query(value.map ? value.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key === '_id' || projection[key]))) : value), lean: async () => value })
  const db = { model: (name) => name === 'Games' ? { findById: () => query(game) } : name === 'GamesTeams' ? { find: () => query(rows) } : { find: () => query([{ _id: 'team', name: 'Искатели' }]) } }
  const route = await load('app/api/[location]/games/check/[id]/route.js', {
    '@helpers/isGameHaveErrors': validation,
    '@utils/dbConnectGlobal': wrap(async () => db),
    '@helpers/fetchTeamsForCabinet': wrap(async () => [{ id: 'team', name: 'Искатели', membersCount: 4 }]),
    '@server/gameHistory/gameManageAccess': { canManageGame: () => true },
    '@app/api/_lib/runLocationLegacyHandler': { runLocationLegacyHandler: async ({ handler, requireAuth }) => {
      assert.equal(requireAuth, true)
      let body, status
      const res = { status: (value) => { status = value; return res }, json: (value) => { body = value; return res } }
      await handler({ query: { id: 'game', location: 'test' }, session: { user: { role: 'admin' } } }, res)
      assert.deepEqual(rows, before)
      return { body, status }
    } },
  })
  const cabinet = await load('app/api/cabinet/games/[gameId]/check/route.js', {
    'next/server': { NextResponse: { json: (body) => body } },
    '@app/api/cabinet/_lib/proxyToLocationGameRoute': { proxyToLocationGameRoute: async ({ gameId, targetPath, method }) => {
      assert.equal(gameId, 'game'); assert.equal(method, 'GET'); assert.equal(targetPath, '/api/:location/games/check/:gameId')
      return route.GET({}, { params: {} })
    } },
  })
  return cabinet.GET({}, { params: Promise.resolve({ gameId: 'game' }) })
}
test('реальный cabinet check → location check блокирует несовместимый маршрут без записей, показывает название', async () => {
  const result = await fixture()
  assert.equal(result.status, 200)
  assert.equal(result.body.data.hasErrors, true)
  assert.match(result.body.data.errors.join(';'), /Искатели.*шаблон.*Распределите/)
})
test('реальная проверка разрешает перестановку в блоке и пустой маршрут', async () => {
  for (const sequence of [[1, 0, 2], [], null]) {
    const result = await fixture({}, [{ _id: 'registration', teamId: 'team', taskSequence: sequence }])
    assert.deepEqual(result.body.data.errors, [])
    assert.equal(result.body.data.hasErrors, false)
  }
})
test('реальная проверка учитывает индивидуальный шаблон, его сброс и лимит игроков', async () => {
  const team = { _id: 'registration', teamId: 'team', taskSequence: [2, 0, 1], taskDistributionTemplate: [[2], [0, 1]] }
  assert.deepEqual((await fixture({}, [team])).body.data.errors, [])
  assert.equal((await fixture({}, [{ ...team, taskDistributionTemplate: [] }])).body.data.hasErrors, true)
  assert.match((await fixture({ maxTeamPlayers: 3 }, [team])).body.data.errors.join(';'), /4 игроков, лимит — 3/)
})
test('реальная проверка блокирует неверный шаблон даже без маршрута', async () => {
  const result = await fixture({ taskDistributionTemplate: [[0, 0], [2]] }, [{ _id: 'registration', teamId: 'team' }])
  assert.match(result.body.data.errors.join(';'), /Общий шаблон.*некорректен/)
})
for (const type of ['classic', 'photo']) test(`${type}: реальная проверка отсекает повреждённые/устаревшие маршруты и игнорирует linear`, async () => {
  for (const sequence of [[0, 0, 2], [0, 1], [0, 1, 2.5], [0, 2, 1]]) {
    const result = await fixture({ type }, [{ _id: 'registration', teamId: 'team', taskSequence: sequence }])
    assert.equal(result.status, 200)
    assert.equal(result.body.data.hasErrors, true)
    assert.match(result.body.data.errors.join(';'), /Искатели.*Распределите/)
  }
  assert.deepEqual((await fixture({ type, taskDistributionMode: 'linear', taskDistributionTemplate: [[0, 0]] })).body.data.errors, [])
})

test('реальная проверка story не добавляет ошибок распределения', async () => {
  const overrides = { type: 'story', taskDistributionTemplate: [[0, 0]] }
  const random = await fixture(overrides)
  const linear = await fixture({ ...overrides, taskDistributionMode: 'linear' })
  assert.equal(random.status, 200)
  assert.deepEqual(random.body.data.errors, linear.body.data.errors)
  assert.ok(!random.body.data.errors.some((error) => /шаблон|Маршрут команды/.test(error)))
})

test('клиентский helper принимает команды и bool helper следует той же проверке; linear не затронут', () => {
  const game = { type: 'photo', startingPlace: 'start', finishingPlace: 'finish', cluesDuration: 0, allowCaptainForceClue: false, tasks: [{ title: 'task', task: 'filled' }], taskDistributionMode: 'random', taskDistributionTemplate: [[0]] }
  const teams = [{ _id: 'team', taskSequence: [0, 0] }]
  assert.match(validation.getGameValidationErrors(game, teams).join(';'), /team.*повреждён/)
  assert.equal(validation.default(game, teams), true)
  assert.deepEqual(validation.getGameValidationErrors({ ...game, taskDistributionMode: 'linear' }, teams), [])
})
