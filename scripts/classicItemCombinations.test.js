import test from 'node:test'
import assert from 'node:assert/strict'
import { runClassicVariants } from '../server/classicVariantsEngine.js'
import { CLASSIC_ITEM_EFFECTS } from '../helpers/classicItemDefinitions.js'
import { getClassicTaskEffectiveElapsedSeconds } from '../helpers/classicGameRules.js'
import buildGameResultComputed from '../server/buildGameResultComputed.js'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const at = (seconds) => new Date(Date.UTC(2026, 10, 4, 12, 0, seconds))
const fixture = () => ({ type: 'classic', status: 'started', taskDuration: 1800, breakDuration: 30, clueIntervals: [300, 450, 900], manyCodesPenalty: [2, 60], taskFailurePenalty: 180,
  classicItems: [...CLASSIC_ITEM_EFFECTS.map(({ type, title, seconds }) => ({ id: type, title, kind: 'stackable', effect: { type, ...(seconds ? { seconds } : {}), ...(['secret_clue', 'compass'].includes(type) ? { text: 'Скрытая помощь' } : {}) } })), { id: 'reward', title: 'Награда', kind: 'stackable' }],
  tasks: [{ _id: 'first', stageKey: 'first', codes: ['a', 'b', 'c'], clues: [{ clue: 'Раз' }, { clue: 'Два' }, { clue: 'Три' }],
    penaltyCodes: [{ code: 'trap', penalty: 120 }, { code: 'trap2', penalty: 90 }], outcomeRewards: { completed: [{ itemId: 'reward', quantity: 2 }], timeout: [{ itemId: 'reward', quantity: 1 }], captain_failed: [{ itemId: 'reward', quantity: 1 }] } },
    { _id: 'second', stageKey: 'second', taskDuration: 2700, codes: ['next'], clues: [] },
    { _id: 'third', stageKey: 'third', taskDuration: 900, codes: ['last'], clues: [] }],
})
const play = (game, team, seconds, extra = {}) => runClassicVariants({ game, gameTeam: team, now: at(seconds), isCaptain: true, ...extra })
const prepare = (game) => play(game, { classicProgress: { inventory: game.classicItems.filter((item) => item.effect).map((item) => ({ itemId: item.id, quantity: 3 })), stages: [], history: [] } }, 0).gameTeam
const use = (game, team, type, seconds = 600, extra = {}) => play(game, team, seconds, { action: 'useItem', stageId: 'first', itemId: type, requestId: `combination-${type}`, ...extra })
const elapsed = (game, team, index, seconds) => getClassicTaskEffectiveElapsedSeconds({ gameTeam: team, task: game.tasks[index], taskIndex: index, startTime: team.startTime[index], now: at(seconds) })
const resultFor = async (game, team, seconds) => (await buildGameResultComputed({ game: { ...game, dateEndFact: at(seconds), result: { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [{ ...team, teamId: 'team' }] } } })).computed.teams[0]

function* permutations(values) {
  if (!values.length) { yield []; return }
  for (let index = 0; index < values.length; index++) {
    for (const rest of permutations(values.filter((_, i) => i !== index))) yield [values[index], ...rest]
  }
}

const assertProgress = (game, team) => {
  assert.ok(Number.isInteger(team.activeNum) && team.activeNum >= 0 && team.activeNum <= game.tasks.length)
  assert.equal(new Set(team.classicProgress.history.map((event) => event.key)).size, team.classicProgress.history.length)
  for (const balance of team.classicProgress.inventory) assert.ok(Number.isSafeInteger(balance.quantity) && balance.quantity >= 0)
  for (let index = 0; index < game.tasks.length; index++) {
    assert.ok(!(team.endTime[index] && team.taskFailures.some((failure) => failure.taskIndex === index)))
    if (team.startTime[index]) assert.ok(Number.isFinite(new Date(team.startTime[index]).getTime()))
    if (team.endTime[index]) assert.ok(new Date(team.endTime[index]) >= new Date(team.startTime[index]))
  }
}

test('40 320 порядков применения всех восьми незавершающих эффектов перед порталом', async () => {
  const game = fixture()
  const initial = play(game, prepare(game), 580, { message: 'trap', stageId: 'first' }).gameTeam
  const types = CLASSIC_ITEM_EFFECTS.map((entry) => entry.type).filter((type) => type !== 'portal')
  let checked = 0
  for (const order of permutations(types)) {
    let team = initial
    for (const type of order) {
      const applied = use(game, team, type, 600, { penaltyKey: type === 'penalty_erase' ? 'code:trap' : null })
      assert.equal(applied.result.statusCode, 200, order.join(' → '))
      team = applied.gameTeam
      assert.equal(team.activeNum, 0)
    }
    team = play(game, team, 610, { message: 'trap2', stageId: 'first' }).gameTeam
    team = play(game, team, 620, { message: 'wrong', stageId: 'first' }).gameTeam
    team = play(game, team, 630, { message: 'wrong', stageId: 'first' }).gameTeam
    team = use(game, team, 'portal', 650).gameTeam
    assert.equal(elapsed(game, team, 0, 650), 300)
    assert.equal(team.timeAddings.find((adding) => adding.source === 'item_time_freeze').time, -50)
    assert.equal(team.activeNum, 0)
    assert.equal(team.classicProgress.history.filter((event) => event.type === 'item_used').length, 9)
    assert.equal(team.classicProgress.history.filter((event) => event.type === 'stage_finished').length, 1)
    assert.equal(team.classicProgress.inventory.find((item) => item.itemId === 'reward').quantity, 2)
    assert.equal(team.classicProgress.stages[0].revealedHelp.length, 2)
    assertProgress(game, team)
    assert.equal(play(game, team, 679).gameTeam.activeNum, 0)
    team = play(game, team, 680).gameTeam
    assert.equal(team.activeNum, 1)
    assert.equal(new Date(team.startTime[1]).getTime(), at(680).getTime())
    assert.equal(elapsed(game, team, 1, 680), 0)
    const replay = use(game, team, 'portal', 680)
    assert.equal(replay.result.statusCode, 200)
    assert.equal(replay.gameTeam.activeNum, 1)
    assert.equal(replay.gameTeam.classicProgress.inventory.find((item) => item.itemId === 'portal').quantity, 2)
    if (checked % 337 === 0) {
      team = play(game, team, 740, { message: 'next', stageId: 'second' }).gameTeam
      team = play(game, team, 770).gameTeam
      team = play(game, team, 790, { message: 'last', stageId: 'third' }).gameTeam
      const computed = await resultFor(game, team, 790)
      assert.deepEqual(computed.taskResults.map((task) => task.seconds), [300, 60, 20])
      assert.equal(computed.baseSeconds, 380)
      assert.equal(computed.codePenaltySeconds, 210)
      assert.equal(computed.manyWrongCodePenaltySeconds, 60)
      assert.equal(computed.addingsSeconds, -210)
      assert.equal(computed.taskResults[0].timeBonusSeconds, 350)
      assert.equal(computed.taskResults[0].itemBonusSeconds, 210)
      assert.equal(computed.failurePenaltySeconds, 0)
      assert.equal(computed.finalSeconds, 440)
    }
    checked++
  }
  assert.equal(checked, 40320)
})

for (const finishing of ['code', 'lockpick', 'portal', 'failTask', 'timeout']) test(`смешанные эффекты и завершение «${finishing}» сохраняют один переход и один исход`, async () => {
  const game = fixture()
  if (finishing === 'failTask') game.tasks[0].clues = [{ clue: 'Одна' }]
  let team = play(game, prepare(game), 580, { message: 'trap', stageId: 'first' }).gameTeam
  for (const type of ['penalty_erase', 'penalty_shield', 'secret_clue', 'compass', 'time_rewind', 'time_freeze', 'lockpick']) team = use(game, team, type, 600, { penaltyKey: type === 'penalty_erase' ? 'code:trap' : null }).gameTeam
  if (finishing !== 'failTask') team = use(game, team, 'free_clue', 610).gameTeam
  team = play(game, team, 620, { message: 'trap2', stageId: 'first' }).gameTeam
  let end = 650
  if (finishing === 'code' || finishing === 'lockpick') team = play(game, team, 640, { message: 'a', stageId: 'first' }).gameTeam
  if (finishing === 'code') team = play(game, team, end, { message: 'b', stageId: 'first' }).gameTeam
  else if (finishing === 'lockpick') team = use(game, team, 'lockpick', end, { requestId: 'combination-lockpick-last' }).gameTeam
  else if (finishing === 'portal') team = use(game, team, 'portal', end).gameTeam
  else if (finishing === 'failTask') team = play(game, team, end, { action: 'failTask', stageId: 'first' }).gameTeam
  else { end = 2220; team = play(game, team, end).gameTeam }
  const events = team.classicProgress.history.filter((event) => event.type === 'stage_finished')
  assert.equal(events.length, 1)
  assert.equal(team.activeNum, 0)
  assert.equal(new Date(team.endTime[0] || team.taskFailures[0].failedAt).getTime(), at(end).getTime())
  assertProgress(game, team)
  const computed = await resultFor(game, team, end)
  assert.equal(computed.taskResults[0].seconds, ['failTask', 'timeout'].includes(finishing) ? 1800 : 300)
  assert.equal(computed.taskResults[0].penaltySeconds, 210 + (['failTask', 'timeout'].includes(finishing) ? 180 : 0))
  const next = play(game, team, end + 30).gameTeam
  assert.equal(next.activeNum, 1)
  assert.equal(new Date(next.startTime[1]).getTime(), at(end + 30).getTime())
  assert.equal(elapsed(game, next, 1, end + 30), 0)
})

test('опоздавшее капитанское действие без этапа после портала не должно проваливать новое задание', () => {
  const game = fixture(); game.breakDuration = 0
  const first = use(game, prepare(game), 'portal').gameTeam
  assert.equal(first.activeNum, 1)
  const late = play(game, first, 600, { action: 'failTask' })
  assert.equal(late.result.statusCode, 400)
  assert.equal(late.gameTeam.activeNum, 1)
  assert.equal(late.gameTeam.taskFailures.length, 0)
})

test('старый этап отклоняет любые поздние действия после мгновенного перехода порталом', () => {
  const game = fixture(); game.breakDuration = 0
  const team = use(game, prepare(game), 'portal').gameTeam
  for (const extra of [{ action: 'forceClue' }, { action: 'failTask' }, { action: 'finishBreak' }, { message: 'next' }, { action: 'useItem', itemId: 'lockpick', requestId: 'late-lockpick' }]) {
    const late = play(game, team, 600, { stageId: 'first', ...extra })
    assert.equal(late.result.statusCode, 409)
    assert.equal(late.gameTeam.activeNum, 1)
    assert.deepEqual(late.gameTeam.findedCodes[1], [])
    assert.equal(late.gameTeam.taskFailures.length, 0)
  }
})

test('100 воспроизводимых последовательностей по 100 смешанных действий сохраняют инварианты прогресса и счёта', async () => {
  for (let seed = 1; seed <= 100; seed++) {
    let state = seed
    const random = (limit) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % limit }
    const game = fixture()
    game.breakDuration = [0, 10, 30][random(3)]
    game.clueEarlyAccessMode = ['time', 'penalty'][random(2)]
    game.clueEarlyPenalty = 900
    let team = prepare(game), seconds = 580
    for (let step = 0; step < 100; step++) {
      seconds += random(46)
      const beforeStep = team.activeNum
      const task = game.tasks[beforeStep]
      const stageId = random(5) === 0 ? 'obsolete-stage' : task?.stageKey
      const kind = random(5)
      let input = {}
      if (kind === 0) {
        const type = CLASSIC_ITEM_EFFECTS[random(CLASSIC_ITEM_EFFECTS.length)].type
        input = { action: 'useItem', itemId: type, requestId: `random-${seed}-${step}`, stageId, penaltyKey: ['code:trap', 'code:trap2', 'wrong:1'][random(3)] }
      } else if (kind === 1) input = { message: ['a', 'b', 'c', 'trap', 'trap2', 'wrong', 'next', 'last'][random(8)], stageId }
      else if (kind === 2) input = { action: ['forceClue', 'failTask', 'finishBreak'][random(3)], stageId }
      else if (kind === 3) {
        const used = team.classicProgress.history.filter((event) => event.type === 'item_used')
        const previous = used[random(used.length)]
        if (previous) input = { action: 'useItem', itemId: previous.itemId, requestId: previous.key.slice('use-item:'.length), stageId: previous.stageId, penaltyKey: previous.penaltyKey }
      }
      team = play(game, team, seconds, input).gameTeam
      assert.ok(team.activeNum >= beforeStep && team.activeNum <= beforeStep + 1, `seed=${seed}, step=${step}`)
      assertProgress(game, team)
      if (team.activeNum < game.tasks.length) assert.ok(elapsed(game, team, team.activeNum, seconds) >= 0)
      for (const progress of team.classicProgress.stages) {
        assert.equal(new Set((progress.waivedPenalties || []).map((entry) => entry.key)).size, progress.waivedPenalties?.length || 0)
        assert.equal(new Set((progress.revealedHelp || []).map((entry) => entry.itemId)).size, progress.revealedHelp?.length || 0)
      }
      if (step % 10 === 0) {
        const computed = await resultFor(game, team, seconds)
        let expected = 0
        for (let index = 0; index < game.tasks.length; index++) {
          const task = game.tasks[index]
          const limit = task.taskDuration || game.taskDuration
          const progress = team.classicProgress.stages.find((entry) => entry.stageId === task.stageKey)
          const adjustments = team.timeAddings.filter((entry) => entry.taskIndex === index && entry.scope === 'task_elapsed')
          const wall = team.endTime[index] ? (new Date(team.endTime[index]) - new Date(team.startTime[index])) / 1000 : null
          const base = wall === null ? limit : Math.max(0, Math.min(limit, wall + adjustments.reduce((sum, entry) => sum + entry.time, 0)))
          const penalties = (task.penaltyCodes || []).filter((entry) => team.findedPenaltyCodes[index].includes(entry.code)).reduce((sum, entry) => sum + entry.penalty, 0)
          const wrong = Math.floor(team.wrongCodes[index].length / 2) * 60
          const refunds = (progress?.waivedPenalties || []).reduce((sum, entry) => sum + entry.seconds, 0)
          expected += base + (wall === null ? 180 : 0) + penalties + wrong - refunds
          assert.equal(computed.taskResults[index].normalizedSeconds, base)
          assert.equal(computed.taskResults[index].itemBonusSeconds, refunds)
          assert.ok(Number.isFinite(computed.taskResults[index].normalizedSeconds))
        }
        assert.equal(computed.finalSeconds, expected, `seed=${seed}, step=${step}`)
      }
    }
  }
})

for (const [action, title, busy] of [['forceClue', 'ForceClue', 'ForcingClue'], ['failTask', 'FailTask', 'FailingTask'], ['finishBreak', 'FinishBreak', 'FinishingBreak']]) test(`подтверждение ${action} отправляет сохранённый этап даже после обновления экрана`, async () => {
  const source = readFileSync(new URL('../components/location-game/GameTeamPageClient.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const extract = (name) => {
    const start = source.indexOf(`  const ${name} = useCallback(`)
    assert.ok(start >= 0)
    const end = source.indexOf('\n  const ', start + 10)
    return source.slice(start, end)
  }
  const sent = []
  const context = vm.createContext({ useCallback: (fn) => fn, taskData: { displayMeta: { classic: { stageId: 'first' } } },
    captainActionStageRef: { current: {} }, isTaskRefreshing: false, [`is${busy}`]: false,
    [`setIs${busy}`]: () => {}, [`setIs${title}ConfirmOpen`]: () => {},
    setStickyMessages: () => {}, setTaskRefreshError: () => {}, updateTaskData: () => {},
    gameId: 'game', teamId: 'team', location: 'krsk', testRunId: null,
    fetch: async (_url, input) => { sent.push(JSON.parse(input.body)); return { ok: true, json: async () => ({ success: true, data: {} }) } },
  })
  vm.runInContext(`${extract(`handle${title}Request`)}\n${extract(`handle${title}`)}\nglobalThis.request = handle${title}Request; globalThis.confirm = handle${title}`, context)
  context.request()
  context.taskData.displayMeta.classic.stageId = 'second'
  await context.confirm()
  assert.equal(sent[0].action, action)
  assert.equal(sent[0].stageId, 'first')
  context.request()
  await context.confirm()
  assert.equal(sent[1].stageId, 'second')
})
