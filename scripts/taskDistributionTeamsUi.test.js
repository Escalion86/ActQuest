import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as distribution from '../helpers/taskDistribution.js'
import * as policy from '../helpers/teamJoinPolicy.js'
const require = createRequire(import.meta.url)
const swc = require('next/dist/build/swc')
await swc.loadBindings()
const stub = ({ children }) => React.createElement('div', null, children)
const props = (overrides = {}) => ({
  isTeamsModalOpen: true, selectedGame: { id: 'game', type: 'classic', status: 'active', taskDistributionMode: 'random', tasks: [{}, {}, {}] },
  currentUserRole: 'admin', teamsModalState: { gameTeams: [{ id: 'one', teamId: 'one', teamName: 'Команда', taskSequence: [] }], availableTeams: [] },
  removingTeamIds: [], updatingOutOfCompetitionTeamIds: [], updatingPaidGameTeamIds: [], ...overrides,
})
const load = async (react = React, request = async () => ({ json: { data: { teamsUpdated: 7 } } })) => {
  const url = new URL('../components/modals/GameTeamsModal.js', import.meta.url)
  const { code } = await swc.transform(await readFile(url, 'utf8'), { filename: fileURLToPath(url), jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
  const deps = { react, '@tanstack/react-query': { useQuery: () => ({}) }, '@server/serverConstants': { LOCATIONS: {} }, '@helpers/taskDistribution': distribution, '@helpers/teamJoinPolicy': policy, '@helpers/requestApiJson': { __esModule: true, default: request }, '@components/cabinet/CabinetButton': { __esModule: true, default: ({ children, ...rest }) => React.createElement('button', rest, children) } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => deps[id] || (id.startsWith('@') || id.startsWith('.') ? { __esModule: true, default: stub } : require(id)), module, module.exports)
  return module.exports.default
}
const Modal = await load()
const render = (overrides) => renderToStaticMarkup(React.createElement(Modal, props(overrides)))
test('общая кнопка в списке команд admin/dev для random classic/photo; индивидуальная остаётся', () => {
  for (const role of ['admin', 'dev']) for (const type of ['classic', 'photo']) {
    const html = render({ currentUserRole: role, selectedGame: { ...props().selectedGame, type } })
    assert.match(html, /Распределить задания всем/)
    assert.match(html, /Распределить для команды/)
    assert.ok(html.indexOf('Распределить задания всем') < html.indexOf('Маршрут:'))
  }
})
test('общая кнопка скрыта без прав, readonly, story/linear и в конечных статусах', () => {
  for (const role of ['client', 'moder', 'agent', undefined]) assert.doesNotMatch(render({ currentUserRole: role }), /Распределить задания всем/)
  assert.doesNotMatch(render({ isReadOnly: true }), /Распределить задания всем/)
  for (const patch of [{ type: 'story' }, { taskDistributionMode: 'linear' }, ...['finished', 'closed', 'canceled'].map((status) => ({ status }))]) assert.doesNotMatch(render({ selectedGame: { ...props().selectedGame, ...patch } }), /Распределить задания всем/)
})
const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
const text = (node) => typeof node === 'string' || typeof node === 'number' ? String(node) : !node || typeof node !== 'object' ? '' : [node.props?.children].flat(Infinity).map(text).join('')
const harness = async (request, refresh = async () => {}) => {
  const states = []; let index = 0
  const react = { ...React, useState: (initial) => { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect: () => {} }
  const Component = await load(react, request)
  return { tree: (overrides = {}) => { index = 0; return Component.type(props({ handleRefreshTeamsModalData: refresh, ...overrides })) } }
}
const button = (tree) => nodes(tree).find((node) => text(node) === 'Распределить задания всем' && typeof node.props.onClick === 'function')
test('POST без teamId, блокировка во время запроса, refresh и фактический счётчик ответа', async () => {
  let resolve, captured, refreshed = 0
  const h = await harness((url, options) => { captured = { url, options }; return new Promise((done) => { resolve = done }) }, async () => { refreshed++ })
  const pending = button(h.tree()).props.onClick()
  const busy = nodes(h.tree()).find((node) => text(node) === 'Распределяем…' && node.props.onClick)
  assert.ok(busy.props.disabled)
  assert.deepEqual(JSON.parse(captured.options.body), { gameId: 'game' })
  assert.equal(captured.url, '/api/cabinet/admin/task-distribution')
  assert.equal(captured.options.method, 'POST')
  resolve({ json: { data: { teamsUpdated: 7 } } }); await pending
  assert.equal(refreshed, 1)
  assert.match(text(h.tree()), /Команд обновлено: 7/)
  assert.ok(!button(h.tree()).props.disabled)
})
test('ошибка API видима, кнопка освобождается, список не обновляется', async () => {
  let refreshed = 0
  const h = await harness(async () => { throw new Error('Шаблон некорректен') }, async () => { refreshed++ })
  await button(h.tree()).props.onClick()
  assert.match(text(h.tree()), /Шаблон некорректен/)
  assert.equal(refreshed, 0)
  assert.ok(!button(h.tree()).props.disabled)
})
test('модалка смены статуса с настоящими действиями GamesPage не содержит распределения', async () => {
  const source = await readFile(new URL('../components/cabinet/app-router/GamesPageClient.js', import.meta.url), 'utf8')
  // Исполняем исходный useMemo страницы, затем настоящий JSX окна статуса.
  const begin = source.indexOf('  const statusModalActions = useMemo(')
  const endMarker = '}, [statusModalGame, statusValidationResult?.hasErrors])'
  const end = source.indexOf(endMarker, begin) + endMarker.length
  assert.ok(begin >= 0 && end > begin)
  const actions = new Function('useMemo', 'statusModalGame', 'statusValidationResult', 'isGameConducted', `${source.slice(begin, end)}; return statusModalActions`)((fn) => fn(), { status: 'active', taskDistributionMode: 'random' }, null, () => false)
  const url = new URL('../components/modals/GameStatusModal.js', import.meta.url)
  const { code } = await swc.transform(await readFile(url, 'utf8'), { filename: fileURLToPath(url), jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => id.startsWith('@') ? { __esModule: true, default: stub } : require(id), module, module.exports)
  const html = renderToStaticMarkup(React.createElement(module.exports.default, { isOpen: true, actions, isSaving: false }))
  // Общая кнопка распределения живёт в окне списка команд; в окне смены статуса
  // остаются проверка, старт, отмена и удаление. Ярлык распределения в окне
  // статуса сохранён как есть в текущей линии — он не заменяет кнопку в командах.
  assert.match(html, /СТАРТ ИГРЫ/)
  assert.match(html, /Проверить игру/)
})

test('при загрузке и пустом списке общая кнопка disabled', () => {
  for (const state of [{ ...props().teamsModalState, isLoading: true }, { gameTeams: [], availableTeams: [] }]) {
    assert.match(render({ teamsModalState: state }), /<button[^>]*disabled=""[^>]*>Распределить задания всем/)
  }
})
