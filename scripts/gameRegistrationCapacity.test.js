import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import mongoose from 'mongoose'
import { getGameRegistrationError, normalizeMaxTeams } from '../helpers/gameRegistration.js'
import { applyGameDraftPatch } from '../helpers/gameDraftDirtyState.js'
import { registerGameTeam } from '../server/registerGameTeam.js'

const root = new URL('../', import.meta.url)
const require = createRequire(import.meta.url)
const swc = require('next/dist/build/swc')
await swc.loadBindings()
const cache = new Map()
// Настоящие JSX редактора и поля; не относящиеся к регистрации секции изолированы.
const realComponents = ['components/cabinet/GameTeamLimit.js', 'components/cabinet/CabinetNumberField.js', 'components/cabinet/CabinetFormField.js', 'components/modals/game-edit/GameEditModal.js']
const load = async (path) => {
  const filename = fileURLToPath(new URL(path, root))
  if (cache.has(filename)) return cache.get(filename)
  const source = await readFile(filename, 'utf8')
  const dependencies = new Map()
  for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
    const id = match[1]
    let dependency = id.startsWith('@') ? id.replace('@helpers/', 'helpers/').replace('@components/', 'components/') : id.startsWith('.') ? fileURLToPath(new URL(id, new URL(path, root))).replace(fileURLToPath(root), '') : null
    if (!dependency) continue
    if (!dependency.endsWith('.js')) dependency += '.js'
    if (path.includes('GameEditModal') && (dependency.startsWith('components/') && !realComponents.includes(dependency))) {
      dependencies.set(id, { __esModule: true, default: ({ children }) => createElement('div', null, children), DEFAULT_MONEY_INPUT_CLASS_NAME: '' })
    } else dependencies.set(id, await load(dependency))
  }
  const { code } = await swc.transform(source, { filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => dependencies.has(id) ? dependencies.get(id) : require(id), module, module.exports)
  cache.set(filename, module.exports)
  return module.exports
}

const fixture = (overrides = {}) => {
  const game = { _id: 'game', status: 'active', registrationOpen: true, maxTeams: 1, ...overrides }
  const registrations = []
  let failCreate = false
  const query = (value) => ({ select: () => query(value), lean: async () => value })
  const games = {
    findOneAndUpdate: (filter, update) => {
      if (game.registrationLock != null) return query(null)
      Object.assign(game, update.$set)
      return query({ ...game })
    },
    updateOne: async (filter) => {
      assert.equal(filter['registrationLock.token'], game.registrationLock.token)
      delete game.registrationLock
    },
  }
  const teams = {
    findOne: ({ gameId, teamId }) => query(registrations.find((row) => row.gameId === gameId && row.teamId === teamId)),
    countDocuments: async () => registrations.length,
    create: async (data) => {
      await new Promise((resolve) => setImmediate(resolve))
      if (failCreate) throw new Error('Ошибка записи')
      const row = { ...data, _id: String(registrations.length + 1) }
      registrations.push(row)
      return row
    },
  }
  return { game, registrations, db: { model: (name) => name === 'Games' ? games : teams }, fail: () => { failCreate = true } }
}
const register = (state, teamId, role = 'client') => registerGameTeam({ db: state.db, gameId: 'game', teamId, role })

test('лимит необязателен, принимает только положительные безопасные целые числа', () => {
  for (const value of [undefined, null, '']) assert.equal(normalizeMaxTeams(value), null)
  for (const value of [1, 25]) assert.equal(normalizeMaxTeams(value), value)
  for (const value of [0, -1, 1.5, NaN, Infinity, '2', true, {}, [], Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => normalizeMaxTeams(value))
})

test('ручное добавление не открывает обычную регистрацию и запрещено в конечных статусах', () => {
  for (const status of ['active', 'started']) {
    const game = { status, registrationOpen: false, maxTeams: 1, teamsCount: 1 }
    assert.equal(getGameRegistrationError(game, { manual: true }), null)
    assert.ok(getGameRegistrationError(game))
  }
  for (const status of ['finished', 'closed', 'canceled', 'draft']) assert.ok(getGameRegistrationError({ status }, { manual: true }))
})

test('конкурирующие запросы не занимают последнее место дважды, повтор после освобождения отклонён', async () => {
  const state = fixture()
  const results = await Promise.allSettled([register(state, 'one'), register(state, 'two')])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(state.registrations.length, 1)
  assert.equal(state.game.registrationLock, undefined)
  await assert.rejects(register(state, 'two'), /лимит команд/)
})

test('admin/dev обходят закрытие и заполненный лимит, client/moder — нет', async () => {
  const state = fixture({ registrationOpen: false })
  for (const role of ['client', 'moder']) await assert.rejects(register(state, role, role), /закрыта/)
  await register(state, 'admin', 'admin')
  await register(state, 'dev', 'dev')
  assert.equal(state.registrations.length, 2)
  state.game.registrationOpen = true
  for (const role of ['client', 'moder']) await assert.rejects(register(state, role, role), /лимит команд/)
})

test('статусы и дубли перепроверяются в защищённом серверном пути', async () => {
  for (const status of ['finished', 'closed', 'canceled']) await assert.rejects(register(fixture({ status }), 'one', 'admin'), /закрыта/)
  const state = fixture({ maxTeams: null })
  await register(state, 'one')
  await assert.rejects(register(state, 'one'), /уже зарегистрирована/)
  await register(state, 'two')
  assert.equal(state.registrations.length, 2)
})

test('ошибка записи освобождает блокировку, зависшая блокировка не истекает самовольно', async () => {
  const state = fixture()
  state.fail()
  await assert.rejects(register(state, 'one'), /Ошибка записи/)
  assert.equal(state.game.registrationLock, undefined)
  state.game.registrationLock = { token: 'старый', acquiredAt: new Date(0) }
  await assert.rejects(register(state, 'two'), /уже обрабатывается/)
  assert.equal(state.game.registrationLock.token, 'старый')
})

test('индивидуальное участие игнорирует лимит команд, но не закрытие и поздний старт', async () => {
  const state = fixture({ participationMode: 'player' })
  await register(state, 'one')
  await register(state, 'two')
  state.game.registrationOpen = false
  await assert.rejects(register(state, 'three', 'admin'), /закрыта/)
  state.game.registrationOpen = true
  state.game.status = 'started'
  await assert.rejects(register(state, 'three'), /закрыта/)
  Object.assign(state.game, { individualStart: true, allowJoinAfterStart: true })
  await register(state, 'three')
})

test('лимит участвует в dirty/reset; закрытая игра не меняет его', () => {
  const baseline = { status: 'active', maxTeams: null, hidden: false }
  const edited = applyGameDraftPatch({ prevGame: baseline, baselineGame: baseline, patch: { maxTeams: 3 } })
  assert.equal(edited.hasUnsavedChanges, true)
  assert.equal(applyGameDraftPatch({ prevGame: edited.nextGame, baselineGame: baseline, patch: { maxTeams: null } }).hasUnsavedChanges, false)
  const closed = { status: 'closed', maxTeams: 3 }
  assert.equal(applyGameDraftPatch({ prevGame: closed, baselineGame: closed, patch: { maxTeams: 5 } }).nextGame.maxTeams, 3)
})

test('настоящая схема Mongoose сохраняет лимит и отклоняет дробный/нулевой', async () => {
  const { default: definition } = await load('schemas/gamesSchema.js')
  const schema = new mongoose.Schema(definition)
  const Game = mongoose.model('RegistrationCapacityTest', schema)
  assert.equal(new Game({}).maxTeams, null)
  assert.equal(new Game({ maxTeams: 4 }).toObject().maxTeams, 4)
  for (const value of [0, -1, 2.5]) assert.ok(new Game({ maxTeams: value }).validateSync()?.errors.maxTeams)
  assert.equal(schema.path('registrationLock').options.select, false)
})

test('настоящий компонент лимита виден только admin/dev при заданном командном лимите', async () => {
  const { default: Limit } = await load('components/cabinet/GameTeamLimit.js')
  for (const role of ['admin', 'dev']) assert.match(renderToStaticMarkup(createElement(Limit, { game: { maxTeams: 5 }, role })), /Лимит команд: 5/)
  for (const role of ['client', 'moder', 'agent', undefined]) assert.equal(renderToStaticMarkup(createElement(Limit, { game: { maxTeams: 5 }, role })), '')
  for (const game of [{}, { maxTeams: null }, { maxTeams: 0 }, { maxTeams: 5, participationMode: 'player' }]) assert.equal(renderToStaticMarkup(createElement(Limit, { game, role: 'admin' })), '')
})

const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
test('настоящий редактор отображает необязательное поле и передаёт число/сброс в draft', async () => {
  const { default: Editor } = await load('components/modals/game-edit/GameEditModal.js')
  let payload
  const props = { selectedGame: { status: 'active', maxTeams: 7 }, canEditSelectedGame: true, updateSelectedGame: (value) => { payload = value } }
  const html = renderToStaticMarkup(createElement(Editor, props))
  assert.match(html, /id="game-max-teams"[^>]*value="7"/)
  assert.match(html, /Лимит команд \(необязательно\)/)
  const field = nodes(Editor.type(props)).find((node) => node.props?.id === 'game-max-teams')
  field.props.onChange({ target: { value: '8' } })
  assert.deepEqual(payload, { maxTeams: 8 })
  field.props.onChange({ target: { value: '' } })
  assert.deepEqual(payload, { maxTeams: null })
  for (const selectedGame of [{ status: 'closed' }, { status: 'active', participationMode: 'player' }]) assert.doesNotMatch(renderToStaticMarkup(createElement(Editor, { ...props, selectedGame })), /game-max-teams/)
})

test('настоящая модалка команд разрешает ручное добавление только admin/dev в active/started', async () => {
  const path = 'components/modals/GameTeamsModal.js'
  const source = await readFile(new URL(path, root), 'utf8')
  const { code } = await swc.transform(source, { filename: fileURLToPath(new URL(path, root)), jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
  const dependencies = {
    '@tanstack/react-query': { useQuery: () => ({}) },
    '@server/serverConstants': { LOCATIONS: {} },
    '@helpers/teamJoinPolicy': await load('helpers/teamJoinPolicy.js'),
    '@helpers/taskDistribution': await load('helpers/taskDistribution.js'),
  }
  const stub = { __esModule: true, default: ({ children }) => createElement('div', null, children) }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => dependencies[id] || (id.startsWith('@') || id.startsWith('.') ? stub : require(id)), module, module.exports)
  const Modal = module.exports.default
  const props = { isTeamsModalOpen: true, teamsModalState: { gameTeams: [], availableTeams: [] }, removingTeamIds: [], updatingOutOfCompetitionTeamIds: [], updatingPaidGameTeamIds: [] }
  const render = (role, status, overrides = {}) => renderToStaticMarkup(createElement(Modal, { ...props, currentUserRole: role, selectedGame: { status, registrationOpen: false, maxTeams: 1, teamsCount: 1 }, ...overrides }))
  for (const role of ['admin', 'dev']) for (const status of ['active', 'started']) assert.match(render(role, status), /Добавить команду/)
  for (const role of ['client', 'moder', 'agent']) assert.doesNotMatch(render(role, 'active'), /Добавить команду/)
  for (const status of ['finished', 'closed', 'canceled']) assert.doesNotMatch(render('admin', status), /Добавить команду/)
  assert.doesNotMatch(render('admin', 'active', { isReadOnly: true }), /Добавить команду/)
  assert.doesNotMatch(render('admin', 'active', { selectedGame: { status: 'active', participationMode: 'player' } }), /Добавить команду/)
})

test('настоящий POST кабинета использует роль сессии, а не ручной флаг клиента', async () => {
  const path = 'app/api/cabinet/games/[gameId]/teams/route.js'
  const source = await readFile(new URL(path, root), 'utf8')
  const { code } = await swc.transform(source, { filename: fileURLToPath(new URL(path, root)), jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })
  let session
  const state = fixture({ registrationOpen: false })
  const query = (value) => ({ select: () => query(value), lean: async () => value })
  const originalModel = state.db.model
  state.db.model = (name) => name === 'Games' ? { ...originalModel(name), findOne: () => query(state.game) } : name === 'Teams' ? { findById: (id) => query({ _id: id, name: id }) } : name === 'TeamsUsers' ? { findOne: () => query({ _id: 'captain' }) } : originalModel(name)
  const dependencies = {
    '@server/registerGameTeam': { registerGameTeam },
    'next-auth': { getServerSession: async () => session },
    '@utils/dbConnectGlobal': { __esModule: true, default: async () => state.db },
    '@server/serverConstants': { LOCATIONS: {} },
    '@server/personalTeams': { isPersonalTeam: () => false },
    '@helpers/adminEventNotifications': { isScheduledGameForTeamEvent: () => false },
    '@helpers/idAndDate': await load('helpers/idAndDate.js'),
    '@helpers/gameRegistration': await load('helpers/gameRegistration.js'),
    '@helpers/teamRoles': await load('helpers/teamRoles.js'),
  }
  const noop = () => null
  const stub = new Proxy({ __esModule: true, default: noop }, { get: (obj, key) => key in obj ? obj[key] : noop })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => dependencies[id] || (id.startsWith('@') ? stub : require(id)), module, module.exports)
  const request = (teamId) => ({ json: async () => ({ teamId, manual: true, role: 'admin', maxTeams: null }) })
  for (const role of ['client', 'moder']) {
    session = { user: { role, userId: '0123456789abcdef01234567' } }
    assert.equal((await module.exports.POST(request(role), { params: { gameId: 'game' } })).status, 403)
  }
  for (const role of ['admin', 'dev']) {
    session = { user: { role } }
    assert.equal((await module.exports.POST(request(role), { params: { gameId: 'game' } })).status, 201)
  }
  state.game.registrationOpen = true
  session = { user: { role: 'client', userId: '0123456789abcdef01234567' } }
  assert.equal((await module.exports.POST(request('three'), { params: { gameId: 'game' } })).status, 409)
  assert.equal(state.registrations.length, 2)
})

test('реальный CRUD создания игры валидирует лимит и сохраняет null/целое число', async () => {
  const path = 'server/CRUD.js'
  const source = await readFile(new URL(path, root), 'utf8')
  const { code } = await swc.transform(source, { filename: fileURLToPath(new URL(path, root)), jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })
  let saved
  const dependencies = {
    './registerGameTeam.js': { registerGameTeam },
    '../helpers/gameRegistration.js': await load('helpers/gameRegistration.js'),
    '@utils/dbConnectGlobal': { __esModule: true, default: async () => ({ model: () => ({ create: async (payload) => { saved = payload; return payload } }) }) },
  }
  const stub = { __esModule: true, default: () => null }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => dependencies[id] || stub, module, module.exports)
  const request = async (maxTeams) => {
    let status, body
    const res = { status: (value) => { status = value; return res }, json: (value) => { body = value; return res } }
    await module.exports.default('Games', { query: { location: 'test' }, method: 'POST', body: { data: { maxTeams } } }, res)
    return { status, body }
  }
  for (const value of [0, -1, 1.5, '2', true, {}]) {
    const result = await request(value)
    assert.equal(result.status, 400)
    assert.match(result.body.error, /положительным целым/)
  }
  for (const value of [null, 5]) {
    assert.equal((await request(value)).status, 201)
    assert.equal(saved.maxTeams, value)
  }
})

test('реальный PUT игры отклоняет некорректный лимит и запись в серверную блокировку до обращения к БД', async () => {
  const path = 'app/api/[location]/games/[id]/route.js'
  const source = await readFile(new URL(path, root), 'utf8')
  const { code } = await swc.transform(source, { filename: fileURLToPath(new URL(path, root)), jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })
  const dependencies = {
    '@helpers/gameRegistration': await load('helpers/gameRegistration.js'),
    '@app/api/_lib/runLocationLegacyHandler': { runLocationLegacyHandler: async ({ request, handler }) => {
      let status, body
      const res = { status: (value) => { status = value; return res }, json: (value) => { body = value; return res } }
      await handler(request, res)
      return { status, body }
    } },
    '@utils/dbConnectGlobal': { __esModule: true, default: async () => { throw new Error('Валидация должна выполняться до БД') } },
  }
  const stub = new Proxy({ __esModule: true, default: () => null }, { get: (obj, key) => key in obj ? obj[key] : () => null })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => dependencies[id] || stub, module, module.exports)
  for (const data of [{ maxTeams: 0 }, { maxTeams: 1.5 }, { maxTeams: '2' }, { registrationLock: null }, { 'registrationLock.token': 'bad' }]) {
    const result = await module.exports.PUT({ method: 'PUT', query: { id: 'game', location: 'test' }, body: { data } }, { params: {} })
    assert.equal(result.status, 400)
  }
})

test('legacy Telegram не обходит лимит, а административные команды берут роль из БД', async () => {
  const state = fixture()
  let role = 'client'
  let selectedTeamId = 'one'
  const query = (value) => ({ select: () => query(value), lean: async () => value })
  const originalModel = state.db.model
  state.db.model = (name) => name === 'TeamsUsers' ? { find: async () => [{ teamId: selectedTeamId }] } : name === 'Users' ? { findOne: () => query({ role }) } : name === 'GamesTeams' ? { ...originalModel(name), find: async ({ teamId }) => state.registrations.filter((row) => row.teamId === teamId) } : originalModel(name)
  const loadCommand = async (path) => {
    const source = await readFile(new URL(path, root), 'utf8')
    const { code } = await swc.transform(source, { filename: fileURLToPath(new URL(path, root)), jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })
    const dependencies = {
      '../../server/registerGameTeam.js': { registerGameTeam },
      'telegram/func/getGame': { __esModule: true, default: async () => state.game },
      'telegram/func/getTeam': { __esModule: true, default: async (id) => ({ _id: id, name: id }) },
      'telegram/func/getAdmins': { __esModule: true, default: async () => [] },
    }
    const stub = { __esModule: true, default: () => null }
    const module = { exports: {} }
    new Function('require', 'module', 'exports', code)((id) => dependencies[id] || stub, module, module.exports)
    return module.exports.default
  }
  const ordinary = await loadCommand('telegram/commands/joinGame.js')
  const invoke = (command) => command({ telegramId: 1, jsonCommand: { gameId: 'game', teamId: selectedTeamId }, db: state.db })
  await invoke(ordinary)
  assert.equal(state.registrations.length, 1)
  selectedTeamId = 'two'
  assert.match((await invoke(ordinary)).message, /лимит команд/)
  for (const path of ['telegram/commands/joinGameAdmin.js', 'telegram/commands/selectTeamToJoinGameAdmin.js']) {
    const command = await loadCommand(path)
    assert.match((await invoke(command)).message, /Недостаточно прав/)
    role = 'admin'
    state.game.registrationOpen = false
    await invoke(command)
    state.game.status = 'finished'
    selectedTeamId += '-next'
    assert.match((await invoke(command)).message, /закрыта/)
    state.game.status = 'active'
    role = 'client'
  }
})

test('оба вида карточек, копирование, проекции и серверные API используют общий контракт', async () => {
  const page = await readFile(new URL('components/cabinet/app-router/GamesPageClient.js', root), 'utf8')
  assert.equal([...page.matchAll(/<GameTeamLimit game=\{game\} role=\{userRole\}/g)].length, 2)
  assert.match(page, /baseDraft.maxTeams = normalizedSource.maxTeams \?\? null/)
  assert.match(page, /maxTeams: game.maxTeams \?\? null/)
  for (const path of ['helpers/fetchGamesForCabinet.js', 'app/api/cabinet/game-details/route.js', 'app/api/cabinet/games/[gameId]/teams/route.js']) assert.match(await readFile(new URL(path, root), 'utf8'), /maxTeams: 1/)
  for (const path of ['server/CRUD.js', 'app/api/cabinet/games/[gameId]/teams/route.js']) assert.match(await readFile(new URL(path, root), 'utf8'), /await registerGameTeam\(/)
  assert.match(await readFile(new URL('app/api/[location]/games/[id]/route.js', root), 'utf8'), /normalizeMaxTeams\(updatePayload.maxTeams\)/)
})
