import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { runClassicVariants } from '../server/classicVariantsEngine.js'
import processClassicVariants from '../server/processClassicVariants.js'
import { resolveClassicGame } from '../helpers/classicVariants.js'
import { getTaskIndexForStep } from '../helpers/taskDistribution.js'
import { normalizeTaskTheme } from '../helpers/taskThemes.js'
import buildTaskDisplayContent from '../helpers/buildTaskDisplayContent.js'
import getGameProcessFinishingPlace from '../helpers/getGameProcessFinishingPlace.js'
import { resolveRequiredMainCodesCount } from '../helpers/classicGameRules.js'

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
const { default: sanitize } = await import('../helpers/sanitize.js')

// Проверяем настоящий расчёт состояния; база не используется при отключённом втором движке.
const source = readFileSync(new URL('../server/getTeamGameTaskState.js', import.meta.url), 'utf8')
const context = vm.createContext({ Date, console, process, taskText, sanitize, normalizeTaskTheme,
  getTaskIndexForStep, buildTaskDisplayContent, getGameProcessFinishingPlace, resolveRequiredMainCodesCount })
vm.runInContext(source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*\n/gm, '')
  .replace(/^export default .*$/gm, '').replace(/^export /gm, '')
  + '\nglobalThis.computeTaskHtml = computeTaskHtml', context)
const render = (game, gameTeam) => context.computeTaskHtml({
  game: resolveClassicGame(game, gameTeam), gameTeam, isGameStarted: true,
  isGameFinished: false, skipAutomaticProgress: true,
})
const makeGame = () => ({ type: 'classic', status: 'started', taskDuration: 3600,
  cluesDuration: 900, breakDuration: 300,
  classicItems: [{ id: 'a', title: 'А', kind: 'unique' }, { id: 'b', title: 'Б', kind: 'unique' }],
  tasks: [
    { _id: 'one', stageKey: 'stage-one', task: 'Первое', codes: ['first'],
      itemRewards: { completed: [{ itemId: 'a', quantity: 1 }, { itemId: 'b', quantity: 1 }] } },
    { _id: 'two', stageKey: 'stage-two', task: 'Запасной путь', codes: ['default'],
      variantConfig: { enabled: true, mode: 'captain' }, variants: ['a', 'b'].map((id) => ({
        id, title: id, conditions: { mode: 'all', rules: [{ type: 'item', itemId: id, quantity: 1 }] },
        content: { task: `Выбранный путь ${id}`, codes: [`code-${id}`], clues: [{ clue: 'Подсказка' }] },
      })) },
    { _id: 'three', stageKey: 'stage-three', task: 'Третье задание', codes: ['last'], clues: [{ clue: 'Третья' }] },
  ],
})
const selectedTeam = (game, variantId = 'a', now = Date.now()) => {
  const play = (team, secondsAgo, extra = {}) => runClassicVariants({
    game, gameTeam: team, now: new Date(now - secondsAgo * 1000), isCaptain: true, ...extra,
  }).gameTeam
  let team = play({ taskSequence: [0, 2, 1] }, 610)
  team = play(team, 600, { message: 'first' })
  team = play(team, 200)
  return play(team, 190, { action: 'selectVariant', stageId: 'stage-two', variantId })
}

for (const variant of ['a', 'b']) {
  test(`выбранный путь ${variant} отображается вместо старого случайного маршрута`, async () => {
    const game = makeGame()
    const team = selectedTeam(game, variant)
    const state = await render(game, team)
    assert.equal(state.taskState, 'active')
    assert.equal(state.taskDisplayTaskText, `Выбранный путь ${variant}`)
  })
  test(`принятый код пути ${variant} сразу отображает перерыв`, async () => {
    const game = makeGame()
    const processed = runClassicVariants({ game, gameTeam: selectedTeam(game, variant),
      isCaptain: true, now: new Date(), message: `code-${variant}`, stageId: 'stage-two' })
    assert.equal(processed.result.message, 'Код принят.')
    assert.ok(processed.gameTeam.endTime[1])
    const state = await render(game, processed.gameTeam)
    assert.equal(state.taskState, 'break')
    assert.match(state.taskHtml, /Задание выполнено/)
  })
}
test('обновление не возвращает полные таймеры выбранного задания', async () => {
  const game = makeGame()
  const team = selectedTeam(game)
  const state = await render(game, team)
  const timers = [...state.taskHtml.matchAll(/data-task-countdown="([^"]+)"[^>]*data-seconds="(\d+)"/g)]
  assert.equal(timers.length, 2)
  assert.ok(Number(timers[0][2]) <= 600, 'таймер подсказки учитывает прошедшие 300 секунд')
  assert.ok(Number(timers[1][2]) <= 3300, 'таймер задания учитывает прошедшие 300 секунд')
  const refreshed = runClassicVariants({ game, gameTeam: team, now: new Date() }).gameTeam
  assert.equal(new Date(refreshed.startTime[1]).getTime(), new Date(team.startTime[1]).getTime())
})
test('исправленный маршрут сохраняется вместе с прогрессом и виден следующему запросу', async () => {
  const game = makeGame()
  let document = { ...selectedTeam(game), _id: 'progress', taskSequence: [0, 2, 1] }
  const previousStart = new Date(document.startTime[1]).getTime()
  const model = {
    findOneAndUpdate(filter, update) {
      return { lean: async () => {
        if (!filter.$or && document.gameProcessLock?.token !== filter['gameProcessLock.token']) return null
        document = { ...document, ...structuredClone(update.$set) }
        return structuredClone(document)
      } }
    },
    async updateOne(filter) {
      if (document.gameProcessLock?.token === filter['gameProcessLock.token']) delete document.gameProcessLock
    },
  }
  const processed = await processClassicVariants({ game, gameTeam: document, gamesTeamsModel: model })
  assert.deepEqual(document.taskSequence, [0, 1, 2])
  assert.deepEqual(processed.gameTeam.taskSequence, [0, 1, 2])
  assert.equal(new Date(document.startTime[1]).getTime(), previousStart)
  assert.equal((await render(game, document)).taskDisplayTaskText, 'Выбранный путь a')
})
test('после перерыва открывается следующее задание с его собственным временем', async () => {
  const game = makeGame()
  const endedAt = new Date(Date.now() - 310000)
  const ended = runClassicVariants({ game, gameTeam: selectedTeam(game, 'a', endedAt.getTime()),
    isCaptain: true, now: endedAt, message: 'code-a', stageId: 'stage-two' }).gameTeam
  const advanced = runClassicVariants({ game, gameTeam: ended, now: new Date() }).gameTeam
  assert.equal(advanced.activeNum, 2)
  assert.equal(new Date(advanced.startTime[2]).getTime(), endedAt.getTime() + 300000)
  const state = await render(game, advanced)
  assert.equal(state.taskState, 'active')
  assert.equal(state.taskDisplayTaskText, 'Третье задание')
})

