import test from 'node:test'
import assert from 'node:assert/strict'
import { runClassicVariants } from '../server/classicVariantsEngine.js'
import { getClassicTaskEffectiveElapsedSeconds } from '../helpers/classicGameRules.js'
import { validateClassicVariants } from '../helpers/classicVariants.js'
import buildGameResultComputed from '../server/buildGameResultComputed.js'
import buildGameStartProgressUpdate from '../server/buildGameStartProgressUpdate.js'
import { resolveTeamBreakState, resolveTeamAgentStatus } from '../helpers/agentGameStatus.js'

const at = (seconds) => new Date(Date.UTC(2026, 10, 3, 12, 0, seconds))
const makeGame = () => ({ type: 'classic', status: 'started', taskDuration: 3600, breakDuration: 10, cluesDuration: 900,
  classicItems: [{ id: 'clock', title: 'Маховик времени', kind: 'stackable', effect: { type: 'time_rewind', seconds: 300, allowedStageIds: [] } }],
  tasks: [
    { _id: 'one', stageKey: 'first', codes: ['first'], bonusCodes: [{ code: 'clock', bonus: 0 }], itemRewards: { codes: [{ category: 'bonus', code: 'clock', items: [{ itemId: 'clock', quantity: 2 }] }] } },
    { _id: 'two', stageKey: 'second', codes: ['finish'], clues: [{ clue: 'Первая' }, { clue: 'Вторая' }, { clue: 'Третья' }] },
  ],
})
const play = (game, gameTeam, seconds, extra = {}) => runClassicVariants({ game, gameTeam, now: at(seconds), isCaptain: true, ...extra })
const prepare = (game) => {
  let team = play(game, {}, 0).gameTeam
  team = play(game, team, 1, { message: 'clock' }).gameTeam
  team = play(game, team, 10, { message: 'first' }).gameTeam
  return play(game, team, 20).gameTeam
}
const use = (game, team, seconds = 620, extra = {}) => play(game, team, seconds, { action: 'useItem', itemId: 'clock', stageId: 'second', requestId: 'request-0001', ...extra })
const elapsed = (game, team, seconds) => getClassicTaskEffectiveElapsedSeconds({ gameTeam: team, task: game.tasks[1], taskIndex: 1, startTime: team.startTime[1], now: at(seconds) })

test('предмет за код переносится на следующее задание и откатывает время с 10 до 5 минут', () => {
  const game = makeGame(), before = prepare(game)
  const { gameTeam: team, result } = use(game, before)
  assert.equal(result.statusCode, 200)
  assert.equal(elapsed(game, team, 620), 300)
  assert.equal(team.classicProgress.inventory[0].quantity, 1)
  assert.equal(new Date(team.startTime[1]).getTime(), new Date(before.startTime[1]).getTime())
  assert.equal(team.timeAddings[0].time, -300)
  assert.equal(team.timeAddings[0].scope, 'task_elapsed')
  assert.equal(team.timeAddings[0].showInAdjustments, true)
  assert.equal(team.classicProgress.history.at(-1).type, 'item_used')
})

test('повтор запроса не расходует вторую копию, другой запрос применяет её ровно один раз', () => {
  const game = makeGame()
  const first = use(game, prepare(game)).gameTeam
  const repeated = use(game, first).gameTeam
  assert.equal(repeated.classicProgress.inventory[0].quantity, 1)
  assert.equal(repeated.timeAddings.length, 1)
  const second = use(game, repeated, 620, { requestId: 'request-0002' }).gameTeam
  assert.equal(elapsed(game, second, 620), 0)
  assert.equal(second.classicProgress.inventory[0].quantity, 0)
  assert.equal(second.timeAddings.length, 2)
  assert.equal(use(game, second, 1000, { requestId: 'request-0003' }).result.statusCode, 409)
})

test('телепорт переносит таймаут и будущие подсказки, сохраняя уже открытые', () => {
  const game = makeGame()
  const team = use(game, prepare(game), 1020).gameTeam
  assert.equal(team.forcedClues[1], 1)
  assert.equal(elapsed(game, team, 1020), 700)
  assert.equal(elapsed(game, team, 2120), 1800)
  assert.equal(play(game, team, 3620).gameTeam.activeNum, 1)
  const expired = play(game, team, 3920).gameTeam
  assert.equal(expired.activeNum, 2)
  assert.equal(new Date(expired.taskFailures[0].failedAt).getTime(), at(3920).getTime())
  assert.equal(expired.endTime[1], null)
})

test('досрочная подсказка и телепорт складываются как корректировки с разными знаками', () => {
  const game = makeGame()
  const early = play(game, prepare(game), 620, { action: 'forceClue', stageId: 'second' }).gameTeam
  assert.equal(elapsed(game, early, 620), 900)
  const team = use(game, early).gameTeam
  assert.equal(elapsed(game, team, 620), 600)
  assert.equal(team.forcedClues[1], 1)
})

for (const [label, seconds, extra, change] of [
  ['участник', 620, { isCaptain: false }],
  ['слишком рано', 100, {}],
  ['старое задание', 620, { stageId: 'first' }],
  ['нет идентификатора запроса', 620, { requestId: '' }],
  ['неизвестный предмет', 620, { itemId: 'missing' }],
  ['таймаут', 3620, {}],
  ['ограничение по заданию', 620, {}, (game) => { game.classicItems[0].effect.allowedStageIds = ['first'] }],
  ['завершённая игра', 620, {}, (game) => { game.status = 'finished' }],
]) test(`применение запрещено: ${label}`, () => {
  const game = makeGame(), before = prepare(game)
  change?.(game)
  const result = use(game, before, seconds, extra)
  assert.ok(result.result.statusCode >= 400)
  assert.equal(result.gameTeam.classicProgress.inventory[0].quantity, 2)
  assert.equal(result.gameTeam.timeAddings.length, 0)
})

test('на перерыве предмет не расходуется', () => {
  const game = makeGame()
  const team = play(game, prepare(game), 620, { message: 'finish' }).gameTeam
  assert.equal(use(game, team, 621).result.statusCode, 409)
})

test('результат отображает бонус в задании и учитывает его ровно один раз', async () => {
  const game = makeGame()
  let team = use(game, prepare(game)).gameTeam
  team = play(game, team, 680, { message: 'finish' }).gameTeam
  const result = await buildGameResultComputed({ game: { ...game, result: { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [{ ...team, teamId: 'team' }] } } })
  const computed = result.computed.teams[0]
  assert.equal(computed.taskResults[1].realSeconds, 660)
  assert.equal(computed.taskResults[1].seconds, 360)
  assert.equal(computed.taskResults[1].timeBonusSeconds, 300)
  assert.match(computed.taskResults[1].adjustments[0].description, /Маховик/)
  assert.equal(computed.addings[0].type, 'bonus')
  assert.equal(computed.addingsSeconds, 0)
  assert.equal(computed.finalSeconds, 370)
})

test('проверка сценария отклоняет некорректные эффекты и ссылки на задания', () => {
  for (const effect of [{ type: 'unknown', seconds: 300 }, { type: 'time_rewind', seconds: -300 }, { type: 'time_rewind', seconds: 0 }, { type: 'time_rewind', seconds: 1.5 }, { type: 'time_rewind', seconds: 300, allowedStageIds: ['missing'] }]) {
    const game = makeGame()
    game.classicItems[0].effect = effect
    assert.ok(validateClassicVariants(game).length > 0)
  }
  assert.deepEqual(validateClassicVariants(makeGame()), [])
})

test('повторный старт очищает эффекты предметов, сохраняя ручные корректировки', () => {
  const manual = { time: -60, name: 'Организатор', scope: 'total_adjustment' }
  const restarted = buildGameStartProgressUpdate({ gameTasksCount: 2, startImmediately: true, timeAddings: [manual, { time: -300, source: 'item_time_rewind', scope: 'task_elapsed' }] })
  assert.deepEqual(restarted.timeAddings, [manual])
})

test('экран и уведомления агента учитывают продлённый телепортом лимит задания', () => {
  const gameTeam = { activeNum: 0, startTime: [at(0)], timeAddings: [{ taskIndex: 0, taskId: 'task', time: -300, source: 'item_time_rewind', scope: 'task_elapsed' }] }
  const params = { gameTeam, tasksCount: 1, breakDurationSeconds: 300, taskDurationSeconds: 3600, now: at(3660) }
  assert.equal(resolveTeamBreakState(params).isTeamOnBreak, false)
  const agent = resolveTeamAgentStatus({ ...params, assignedTaskIndexes: [0] })
  assert.equal(agent.status, 'active')
  assert.equal(agent.currentTaskSeconds, 3360)
  assert.deepEqual(resolveTeamBreakState({ ...params, now: at(3960) }), { isTeamOnBreak: true, breakTimeLeftSeconds: 240 })
})
