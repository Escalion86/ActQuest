import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { loader } from './copyGameTasks.fixture.mjs'
const require = createRequire(import.meta.url), React = require('react')
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.footer)]
const flush = () => new Promise(resolve => setImmediate(resolve))
function fixture(extra = {}) {
  const states = [], refs = [], effects = []; let slot = 0, rslot = 0, tree
  const hooks = { ...React, useState(initial) { const i = slot++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] }, useRef(initial) { return refs[rslot++] ||= { current: initial } }, useEffect(fn) { effects.push(fn) }, useMemo: fn => fn(), useCallback: fn => fn }
  const props = { sourceGame: { id: 'source', name: 'Источник', type: 'classic' }, isDirty: false, onSave: async () => ({ id: 'source' }), onClose() {}, onOpenTarget() {}, onCopied() {}, ...extra }
  const Component = loader({ react: hooks })('@components/modals/game-tasks/CopyGameTasksModal').default
  return { props, effects, render() { slot = rslot = 0; tree = Component(props); return tree }, nodes: () => nodes(tree), button(label) { return nodes(tree).find(n => n.props?.children === label && typeof n.props?.onClick === 'function') } }
}
const data = { tasks: [{ id: 't1', title: 'Первое' }, { id: 't2', title: 'Второе' }], targets: [{ id: 'target', name: 'Назначение', type: 'classic', status: 'active' }] }
async function withApi(fn) { const original = globalThis.fetch, requests = []; let error = false, hold = null; globalThis.fetch = async (url, options) => { requests.push({ url, options }); if (options?.method === 'POST') { if (hold) await hold; return error ? Response.json({ error: 'Отказ сервера' }, { status: 409 }) : Response.json({ success: true, data: { targetGameId: 'target', count: 2 } }) } return Response.json({ success: true, data }) }; try { await fn({ requests, fail: value => { error = value }, hold: promise => { hold = promise } }) } finally { globalThis.fetch = original } }
test('реальный JSX: выбор, все, disabled, назад/отмена, подтверждение, ошибка и серверный успех', async () => withApi(async api => {
  let closed = false, opened = '', copied = 0
  const f = fixture({ onClose: () => { closed = true }, onOpenTarget: id => { opened = id }, onCopied: () => { copied++ } }); f.render(); f.effects[0](); await flush(); f.render()
  assert.equal(f.button('Выбрать игру, куда копировать').props.disabled, true)
  let checks = () => f.nodes().filter(n => n.type === 'input' && n.props.type === 'checkbox')
  checks()[1].props.onChange({ target: { checked: true } }); f.render(); assert.equal(f.button('Выбрать игру, куда копировать').props.disabled, false)
  checks()[0].props.onChange({ target: { checked: true } }); f.render(); assert.ok(checks().every(n => n.props.checked))
  f.button('Выбрать игру, куда копировать').props.onClick(); f.render(); f.button('Назад').props.onClick(); f.render(); assert.equal(checks()[1].props.checked, true)
  f.button('Выбрать игру, куда копировать').props.onClick(); f.render(); f.nodes().find(n => n.type === 'input' && n.props.type === 'radio').props.onChange(); f.render(); f.button('Продолжить').props.onClick(); f.render()
  assert.match(JSON.stringify(f.nodes().map(n => n.props?.children)), /Назначение/)
  api.fail(true); await f.button('Скопировать').props.onClick(); f.render(); assert.equal(copied, 0); assert.ok(f.nodes().find(n => n.props?.role === 'alert')); const key = JSON.parse(api.requests.at(-1).options.body).requestId
  api.fail(false); let release; api.hold(new Promise(resolve => { release = resolve })); const saving = f.button('Скопировать').props.onClick(); f.render(); assert.equal(f.button('Скопировать').props.disabled, true); assert.equal(f.button('Открыть задания целевой игры'), undefined); release(); await saving; f.render(); assert.equal(copied, 1); assert.equal(JSON.parse(api.requests.at(-1).options.body).requestId, key)
  await f.button('Открыть задания целевой игры').props.onClick(); assert.equal(opened, 'target')
  f.button('Закрыть').props.onClick(); assert.equal(closed, true)
}))
test('dirty: до явного сохранения нет GET/POST, неуспешное сохранение блокирует копирование', async () => withApi(async api => {
  let saves = 0, allow = false
  const f = fixture({ isDirty: true, onSave: async () => { saves++; return allow ? { id: 'source' } : null } }); f.render(); f.effects[0](); await flush(); f.render(); assert.equal(api.requests.length, 0)
  await f.button('Сохранить и продолжить').props.onClick(); f.render(); assert.equal(saves, 1); assert.equal(api.requests.length, 0); assert.ok(f.nodes().find(n => n.props?.role === 'alert'))
  allow = true; await f.button('Сохранить и продолжить').props.onClick(); f.render(); assert.equal(saves, 2); assert.equal(api.requests.length, 1); assert.ok(f.button('Выбрать игру, куда копировать'))
}))
test('отмена до отправки не вызывает POST', async () => withApi(async api => { let closed = false; const f = fixture({ onClose: () => { closed = true } }); f.render(); f.effects[0](); await flush(); f.render(); f.button('Отмена').props.onClick(); assert.equal(closed, true); assert.ok(api.requests.every(r => r.options?.method !== 'POST')) }))

test('настоящая GamesPage: открытие цели вне фильтра переживает refetch списка и сохраняет отдельный черновик', async () => {
  const { readFileSync } = await import('node:fs')
  const states = [], refs = [], effects = []; let slot = 0, refSlot = 0, tree
  const hooks = { ...React, useState(initial) { const i = slot++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] }, useRef(initial) { return refs[refSlot++] ||= { current: initial } }, useEffect(fn) { effects.push(fn) }, useMemo: fn => fn(), useCallback: fn => fn }
  const source = { id: '111111111111111111111111', name: 'Прошлая игра', status: 'closed', type: 'classic', location: 'krsk', tasks: [] }, target = { id: '222222222222222222222222', name: 'Предстоящая игра', status: 'active', type: 'classic', location: 'krsk', tasks: [{ id: 'copied', title: 'Копия', codes: ['код'], clues: [], subTasks: [] }] }
  const query = { data: { pages: [{ games: [source], hasMore: false }] }, hasNextPage: false }, client = { setQueriesData() {}, invalidateQueries() {} }
  const mocks = { react: hooks, '@helpers/useMergedSession': session => ({ activeSession: session }), 'next/navigation': { useRouter: () => ({ replace() {}, push() {} }), usePathname: () => '/cabinet/games-past', useSearchParams: () => new URLSearchParams() }, '@tanstack/react-query': { useQueryClient: () => client, useInfiniteQuery: () => query, useQuery: () => ({ data: undefined }), useMutation: () => ({ isPending: false }) } }
  const sourceCode = readFileSync('components/cabinet/app-router/GamesPageClient.js','utf8')
  for (const [,id] of sourceCode.matchAll(/from '(@components\/[^']+)'/g)) mocks[id] = function Placeholder() { return null }
  const GameModals = mocks['@components/modals/GameModals']
  mocks['@components/cabinet/CardActionIconButton'] = { __esModule: true, default: () => null, ...Object.fromEntries(['AgentCardIcon','ChatCardIcon','EditCardIcon','FinanceCardIcon','GameControlCardIcon','HistoryCardIcon','MapCardIcon','StatusCardIcon','TargetCardIcon','TeamCardIcon','TestRunCardIcon'].map(name => [name, () => null])) }
  const Page = loader(mocks)('@components/cabinet/app-router/GamesPageClient').default
  const props = { initialGames: [source], initialHasMore: false, initialLocation: 'krsk', session: { user: { id: '333333333333333333333333', role: 'admin', location: 'krsk' } }, availableModerators: [], forcedView: 'past' }
  const render = () => { slot = refSlot = 0; tree = Page(props) }, modal = () => nodes(tree).find(n => n.type === GameModals)
  const original = globalThis.fetch
  globalThis.fetch = async url => { assert.match(url,/game-details/); return Response.json({ success: true, data: target }) }
  try {
    render(); assert.ok(modal()); await modal().props.onOpenCopiedTasks(target.id); render(); assert.equal(modal().props.selectedGame.id,target.id); assert.equal(modal().props.editGame.tasks[0].title,'Копия')
    const refresh = effects.findLast(fn => fn.toString().includes('gamesQuery.data.pages.flatMap')); assert.ok(refresh); refresh(); render()
    assert.equal(modal().props.selectedGame.id,target.id,'refetch списка прошлых игр не переключает редактор на источник'); assert.equal(modal().props.editGame.id,target.id); assert.equal(modal().props.isTasksModalOpen,true)
  } finally { globalThis.fetch = original }
})
