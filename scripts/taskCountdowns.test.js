import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@helpers/')) {
    return nextResolve(new URL(`../helpers/${specifier.slice(9)}.js`, import.meta.url).href, context)
  }
  if (specifier.startsWith('./') && context.parentURL && !context.parentURL.includes('/node_modules/')) {
    const url = new URL(`${specifier}.js`, context.parentURL)
    if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
  }
  return nextResolve(specifier, context)
} })
const { default: taskText } = await import('../telegram/func/taskText.js')
const render = (extra = {}) => taskText({
  game: { type: 'classic', tasks: [{ task: 'Задание', codes: ['КОД'], clues: [{ clue: 'Подсказка' }] }] },
  taskNum: 0, startTaskTime: new Date(), taskDuration: 3600, cluesDuration: 1200,
  format: 'web', ...extra,
})
const countdowns = (html) => [...html.matchAll(/<span ([^>]*data-task-countdown="([^"]+)"[^>]*)>/g)].map((m) => ({
  type: m[2], seconds: Number(m[1].match(/data-seconds="([^"]+)"/)?.[1]),
}))

test('до подсказки одновременно доступны оба таймера', () => {
  const timers = countdowns(render())
  assert.deepEqual(timers.map((timer) => timer.type), ['hint', 'task'])
  assert.equal(timers[1].seconds - timers[0].seconds, 2400)
})
test('после всех подсказок остаётся один таймер задания', () => {
  assert.deepEqual(countdowns(render({ visibleCluesCount: 1 })).map((timer) => timer.type), ['task'])
})
test('без подсказок остаётся один таймер задания', () => {
  assert.deepEqual(countdowns(render({ cluesDuration: 0 })).map((timer) => timer.type), ['task'])
})

test('без лимита задания нулевой таймер не запускает бесконечные обновления', () => {
  assert.deepEqual(countdowns(render({ taskDuration: 0 })).map((timer) => timer.type), ['hint'])
  assert.deepEqual(countdowns(render({ taskDuration: 0, cluesDuration: 0 })), [])
})
test('досрочная подсказка сокращает оба таймера одинаково', () => {
  const timers = countdowns(render({ timeAddings: [{ source: 'captain_force_clue', taskIndex: 0, time: 300 }] }))
  assert.equal(timers.length, 2)
  assert.ok(timers[0].seconds <= 900 && timers[0].seconds >= 899)
  assert.ok(timers[1].seconds <= 3300 && timers[1].seconds >= 3299)
})
test('панель показывает оба таймера и обновляет их каждую секунду', () => {
  const source = readFileSync(new URL('../components/location-game/GameTeamPageClient.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = source.indexOf('  useEffect(() => {\n    if (!isClient) return\n    const container = taskContentRef.current')
  const end = source.indexOf('\n  }, [', start)
  assert.ok(start >= 0 && end > start, 'Эффект обновления таймеров должен присутствовать в компоненте')
  const body = source.slice(start + '  useEffect(() => {'.length, end)
  const panel = { style: {}, innerHTML: '' }
  let now = 100000
  let tick
  const makeNode = (type, seconds) => ({ textContent: '', getAttribute: (name) => ({
    'data-task-countdown': type, 'data-seconds': String(seconds), 'data-refresh-on-complete': 'true',
  })[name] ?? null })
  const nodes = [makeNode('hint', 1200), makeNode('task', 3600)]
  vm.runInNewContext(`(function() {${body}\n})()`, {
    isClient: true, taskContentRef: { current: { querySelectorAll: () => nodes } },
    countdownPanelRef: { current: panel }, countdownPanelLabelRef: { current: {} }, countdownPanelValueRef: { current: {} },
    Date: { now: () => now }, formatCountdownSeconds: (seconds) => String(seconds),
    refreshRequestedRef: { current: now }, handleTaskRefresh: async () => true,
    window: { setInterval: (fn) => { tick = fn; return 1 }, clearInterval: () => {} },
  })
  assert.match(panel.innerHTML, /До следующей подсказки:/)
  assert.match(panel.innerHTML, /До завершения задания:/)
  assert.match(panel.innerHTML, />1200</)
  assert.match(panel.innerHTML, />3600</)
  now += 1000
  tick()
  assert.match(panel.innerHTML, />1199</)
  assert.match(panel.innerHTML, />3599</)
})

test('во время заморозки таймеры подсказки и задания стоят, отдельный таймер завершает паузу', () => {
  const source = readFileSync(new URL('../components/location-game/GameTeamPageClient.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = source.indexOf('  useEffect(() => {\n    if (!isClient) return\n    const container = taskContentRef.current')
  const end = source.indexOf('\n  }, [', start)
  const body = source.slice(start + '  useEffect(() => {'.length, end)
  const panel = { style: {}, innerHTML: '' }
  let now = 100000, tick, refreshes = 0
  const node = (type, seconds, pause = 0) => ({ textContent: '', getAttribute: (name) => ({
    'data-task-countdown': type, 'data-seconds': String(seconds), 'data-pause-seconds': String(pause), 'data-refresh-on-complete': 'true',
  })[name] ?? null })
  const nodes = [node('hint', 700, 120), node('task', 2000, 120), node('freeze', 120)]
  vm.runInNewContext(`(function() {${body}\n})()`, {
    isClient: true, taskContentRef: { current: { querySelectorAll: () => nodes } },
    countdownPanelRef: { current: panel }, countdownPanelLabelRef: { current: {} }, countdownPanelValueRef: { current: {} },
    Date: { now: () => now }, formatCountdownSeconds: String,
    refreshRequestedRef: { current: now }, handleTaskRefresh: async () => { refreshes++; return true },
    window: { setInterval: (fn) => { tick = fn; return 1 }, clearInterval: () => {} },
  })
  now += 50000; tick()
  assert.equal(nodes[0].textContent, '700')
  assert.equal(nodes[1].textContent, '2000')
  assert.equal(nodes[2].textContent, '70')
  assert.equal(refreshes, 0)
  assert.match(panel.innerHTML, /Заморозка времени закончится через/)
  now += 70000; tick()
  assert.equal(refreshes, 1)
  assert.equal(nodes[0].textContent, '700')
  now += 1000; tick()
  assert.equal(nodes[0].textContent, '699')
  assert.equal(nodes[1].textContent, '1999')
  assert.equal(refreshes, 1)
})

test('сервер передаёт клиенту оставшуюся заморозку отдельно от времени задания', () => {
  const html = render({ startTaskTime: new Date(Date.now() - 100_000), timeAddings: [{ source: 'item_time_freeze', scope: 'task_elapsed', taskIndex: 0, time: -120, createdAt: new Date(Date.now() - 30_000) }] })
  const timers = countdowns(html)
  assert.deepEqual(timers.map((timer) => timer.type), ['hint', 'task', 'freeze'])
  assert.ok(timers[0].seconds >= 1129 && timers[0].seconds <= 1130)
  assert.ok(timers[1].seconds >= 3529 && timers[1].seconds <= 3530)
  assert.ok(timers[2].seconds >= 89 && timers[2].seconds <= 90)
  assert.equal([...html.matchAll(/data-pause-seconds="\d+"/g)].length, 2)
})
