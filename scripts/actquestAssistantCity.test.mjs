import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import * as questions from '../helpers/assistantQuestions.mjs'
import * as visibility from '../helpers/assistantVisibility.mjs'

// Настоящий JSX через SWC; hook-стенд контролирует состояние без браузера.
export async function fixture() {
  const require = createRequire(import.meta.url)
  const swc = require('next/dist/build/swc'); await swc.loadBindings()
  const filename = fileURLToPath(new URL('../components/public/ActQuestAssistant.js', import.meta.url))
  const source = await readFile(filename, 'utf8')
  const { code } = await swc.transform(source.replace('async function ask(', 'captureAsk(ask); async function ask(') + '\nexport { AssistantPanel }', {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  })
  let cursor = 0, states = [], effects = [], ask, path = '/', auth = { data: null, status: 'unauthenticated' }
  const hooks = { ...require('react'), useEffect: fn => effects.push(fn), useRef: () => ({ current: null }), useState: initial => {
    const slot = cursor++; if (!(slot in states)) states[slot] = initial
    return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
  } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'captureAsk', code)(name => name === 'react' ? hooks : name === 'next/navigation' ? { usePathname: () => path } : name === 'next-auth/react' ? { useSession: () => auth } : name.includes('assistantVisibility') ? visibility : name.includes('assistantQuestions') ? questions : require(name), module, module.exports, fn => { ask = fn })
  return {
    wrapper: (pathname, sessionCity, user = 'one', status = 'authenticated') => { path = pathname; auth = { status, data: status === 'unauthenticated' ? null : { user: { id: user, location: sessionCity } } }; return module.exports.default() },
    settingsEffect: () => effects[0](),
    panel: initialCity => { cursor = 0; effects = []; return module.exports.AssistantPanel({ initialCity, pathname: path }) },
    open: () => { states[0] = true }, ai: value => { states[7] = value }, ask: text => ask(text),
  }
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(node => nodes(node, predicate))
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}
const buttons = tree => nodes(tree, node => node.type === 'button')

for (const path of ['/', '/krsk', '/nrsk', '/ekb']) test(`город: публичный ${path} не угадывает профиль или URL`, async () => {
  const f = await fixture()
  for (const city of ['krsk', 'nrsk', 'ekb', null, 'unknown']) assert.equal(f.wrapper(path, city).props.initialCity, null)
})
test('город: кабинет принимает только валидный город профиля', async () => {
  const f = await fixture()
  for (const city of ['krsk', 'nrsk', 'ekb', null, undefined, 'unknown']) assert.equal(f.wrapper('/cabinet/teams', city).props.initialCity, visibility.ASSISTANT_CITIES[city] ? city : null)
})
test('город: resolver учитывает границу кабинета и не принимает неизвестные значения', () => {
  assert.equal(typeof visibility.resolveInitialAssistantCity, 'function')
  for (const path of ['/cabinet', '/cabinet/profile']) for (const city of ['krsk', 'nrsk', 'ekb']) assert.equal(visibility.resolveInitialAssistantCity(path, city), city)
  for (const path of ['/', '/krsk', '/cabinetish', '/cabinet/test']) assert.equal(visibility.resolveInitialAssistantCity(path, 'krsk'), null)
  for (const city of [null, undefined, 'unknown', {}, 'KRsk']) assert.equal(visibility.resolveInitialAssistantCity('/cabinet', city), null)
})
test('город: открытая панель без города показывает только три явных выбора, без формы и FAQ', async () => {
  const f = await fixture(); f.open()
  const tree = f.panel(null), markup = renderToStaticMarkup(tree)
  assert.match(markup, /В каком городе хотите играть\?/)
  assert.equal(buttons(tree).length, 5) // Закрыть, три города, launcher.
  assert.equal(nodes(tree, n => ['form', 'textarea', 'select'].includes(n.type)).length, 0)
  assert.doesNotMatch(markup, /Что такое автоквест\?|Какие ближайшие игры\?/)
  for (const title of Object.values(visibility.ASSISTANT_CITIES)) assert.equal(buttons(tree).filter(n => n.props.children === title).length, 1)
})
test('город: guard ask не делает fetch даже при прямом вызове до выбора', async () => {
  const f = await fixture(); f.open(); f.panel(null)
  const original = globalThis.fetch; let calls = 0
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ success: true, answer: 'Ответ' }) } }
  try { await f.ask('Что такое автоквест?'); assert.equal(calls, 0) } finally { globalThis.fetch = original }
})
test('город: явный выбор включает обычную панель и отправляет выбранный город; смена очищает диалог', async () => {
  const f = await fixture(); f.open(); f.ai(true)
  let tree = f.panel(null)
  const choice = buttons(tree).find(n => n.props.children === 'Норильск'); assert.ok(choice); choice.props.onClick()
  tree = f.panel(null)
  assert.equal(nodes(tree, n => n.type === 'select')[0].props.value, 'nrsk')
  assert.equal(nodes(tree, n => n.type === 'form').length, 1)
  assert.doesNotMatch(renderToStaticMarkup(tree), /В каком городе хотите играть/)
  const original = globalThis.fetch; let payload
  globalThis.fetch = async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ success: true, answer: 'Ответ', games: [{ gameId: 'game-1', title: 'Игра' }] }) } }
  try {
    await f.ask('Хочу записаться'); assert.equal(payload.city, 'nrsk')
    tree = f.panel(null)
    const game = buttons(tree).find(n => n.props.children === 'Игра'); assert.ok(game); game.props.onClick()
    await new Promise(resolve => setImmediate(resolve))
    tree = f.panel(null)
    nodes(tree, n => n.type === 'textarea')[0].props.onChange({ target: { value: 'Черновик' } })
    tree = f.panel(null)
    assert.equal(nodes(tree, n => n.type === 'textarea')[0].props.value, 'Черновик')
    nodes(tree, n => n.type === 'select')[0].props.onChange({ target: { value: 'ekb' } })
    tree = f.panel(null)
    assert.equal(nodes(tree, n => n.type === 'textarea')[0].props.value, '')
    assert.doesNotMatch(renderToStaticMarkup(tree), /Черновик|Выбрать:|>Ответ</)
    await f.ask('Как подготовиться?'); assert.equal(payload.city, 'ekb'); assert.deepEqual(payload.history, []); assert.ok(!('gameId' in payload))
  } finally { globalThis.fetch = original }
})
test('шапка: точная служебная подпись удалена из настоящего открытого JSX', async () => {
  const f = await fixture(); f.open()
  assert.doesNotMatch(renderToStaticMarkup(f.panel('krsk')), /FAQ и советы — без ИИ; свободные вопросы — выбор источников ИИ/)
})
test('город: ключ сохраняет кабинетный контекст, но сбрасывает при identity/logout/sessionCity/public', async () => {
  const f = await fixture(), initial = f.wrapper('/cabinet', 'krsk').key
  assert.equal(f.wrapper('/cabinet/teams', 'krsk').key, initial)
  assert.notEqual(f.wrapper('/cabinet', 'krsk', 'two').key, initial)
  assert.notEqual(f.wrapper('/cabinet', null, 'one', 'unauthenticated').key, initial)
  assert.notEqual(f.wrapper('/cabinet', 'nrsk').key, initial)
  const publicKey = f.wrapper('/', 'krsk').key
  assert.notEqual(publicKey, initial)
  assert.notEqual(f.wrapper('/krsk', 'nrsk').key, publicKey)
  assert.equal(f.wrapper('/ekb', 'krsk').key, publicKey)
})
