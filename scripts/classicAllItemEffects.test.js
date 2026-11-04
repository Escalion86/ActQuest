import test from 'node:test'
import assert from 'node:assert/strict'
import { runClassicVariants } from '../server/classicVariantsEngine.js'
import { getClassicTaskEffectiveElapsedSeconds } from '../helpers/classicGameRules.js'
import { getClassicItemUseBlockReason } from '../helpers/classicItemEffects.js'
import { getClassicPenaltyCandidates } from '../helpers/classicItemProgress.js'
import { classicPublicInventory, validateClassicVariants } from '../helpers/classicVariants.js'
import { CLASSIC_ITEM_EFFECTS } from '../helpers/classicItemDefinitions.js'
import { getTimedCluesCountForTask } from '../helpers/taskTiming.js'
import buildGameResultComputed from '../server/buildGameResultComputed.js'
import buildGameStartProgressUpdate from '../server/buildGameStartProgressUpdate.js'
import { resolveTeamBreakState, resolveTeamAgentStatus } from '../helpers/agentGameStatus.js'

const at = (seconds) => new Date(Date.UTC(2026, 10, 3, 12, 0, seconds))
const gameFixture = () => ({ type: 'classic', status: 'started', taskDuration: 1000, breakDuration: 30, cluesDuration: 300,
  taskFailurePenalty: 180, manyCodesPenalty: [2, 60],
  classicItems: CLASSIC_ITEM_EFFECTS.map(({ type, title, seconds }) => ({ id: type, title, kind: 'stackable', effect: { type, ...(seconds ? { seconds } : {}), ...(['secret_clue', 'compass'].includes(type) ? { text: 'СЕКРЕТ: ищите башню', image: 'https://example.org/map.png' } : {}) } })),
  tasks: [{ _id: 'task', stageKey: 'stage', codes: ['a', 'b', 'c'], numCodesToCompliteTask: 2,
    penaltyCodes: [{ code: 'trap', penalty: 120 }, { code: 'trap2', penalty: 90 }],
    clues: [{ clue: 'Первая' }, { clue: 'Вторая' }, { clue: 'Третья' }],
    itemRewards: { codes: [{ category: 'main', code: 'a', items: [{ itemId: 'compass', quantity: 1 }] }] },
    outcomeRewards: { completed: [{ itemId: 'portal', quantity: 1 }] } }, { _id: 'next', stageKey: 'next', codes: ['end'] }],
})
const play = (game, team, seconds, extra = {}) => runClassicVariants({ game, gameTeam: team, now: at(seconds), isCaptain: true, ...extra })
const prepare = (game) => play(game, { classicProgress: { inventory: game.classicItems.map((item) => ({ itemId: item.id, quantity: 2 })), stages: [], history: [] } }, 0).gameTeam
const use = (game, team, type, seconds = 100, extra = {}) => play(game, team, seconds, { action: 'useItem', stageId: 'stage', itemId: type, requestId: `request-${type}`, ...extra })
const elapsed = (game, team, seconds) => getClassicTaskEffectiveElapsedSeconds({ gameTeam: team, task: game.tasks[0], taskIndex: 0, startTime: team.startTime[0], now: at(seconds) })
const quantity = (team, id) => team.classicProgress.inventory.find((entry) => entry.itemId === id)?.quantity || 0
const stage = (team) => team.classicProgress.stages[0]
const computed = async (game, team) => (await buildGameResultComputed({ game: { ...game, dateEndFact: at(1200), result: { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [{ ...team, teamId: 'team' }] } } })).computed.teams[0]

test('каталог поддерживает все девять эффектов и проверяет скрытую помощь', () => {
  const game = gameFixture()
  assert.equal(game.classicItems.length, 9)
  assert.deepEqual(validateClassicVariants(game), [])
  for (const effect of [{ type: 'compass' }, { type: 'secret_clue', text: 5 }, { type: 'compass', image: 'javascript:alert(1)' }, { type: 'time_freeze', seconds: -1 }]) {
    game.classicItems[0].effect = effect
    assert.ok(validateClassicVariants(game).length > 0)
  }
})

test('бесплатная подсказка не переводит часы, сохраняется после отката и не выдаётся сверх количества', () => {
  const game = gameFixture()
  let team = use(game, prepare(game), 'free_clue', 400).gameTeam
  assert.equal(elapsed(game, team, 400), 400)
  assert.equal(team.forcedClues[0], 2)
  assert.equal(team.timeAddings.length, 0)
  team = use(game, team, 'time_rewind', 400).gameTeam
  assert.equal(elapsed(game, team, 400), 100)
  assert.equal(team.forcedClues[0], 2)
  team = use(game, team, 'free_clue', 400, { requestId: 'request-second-clue' }).gameTeam
  assert.equal(team.forcedClues[0], 3)
  const denied = use(game, team, 'free_clue', 400, { requestId: 'request-third-clue' })
  assert.equal(denied.result.statusCode, 409)
  assert.equal(quantity(denied.gameTeam, 'free_clue'), 0)
})

for (const type of ['secret_clue', 'compass']) test(`${type}: содержимое скрыто до применения и открывается один раз на задании`, () => {
  const game = gameFixture(), before = prepare(game)
  assert.ok(!JSON.stringify(classicPublicInventory(game, before)).includes('СЕКРЕТ'))
  assert.ok(!JSON.stringify(classicPublicInventory(game, before)).includes('map.png'))
  const applied = use(game, before, type)
  assert.equal(applied.result.statusCode, 200)
  assert.equal(stage(applied.gameTeam).revealedHelp[0].text, 'СЕКРЕТ: ищите башню')
  const repeated = use(game, applied.gameTeam, type, 110)
  assert.equal(repeated.result.statusCode, 200)
  const denied = use(game, repeated.gameTeam, type, 120, { requestId: 'request-help-again' })
  assert.equal(denied.result.statusCode, 409)
  assert.equal(quantity(denied.gameTeam, type), 1)
  assert.equal(stage(denied.gameTeam).revealedHelp.length, 1)
})

test('заморозка держит часы и подсказки, после окончания отсчёт продолжается', () => {
  const game = gameFixture(), team = use(game, prepare(game), 'time_freeze', 250).gameTeam
  assert.equal(elapsed(game, team, 250), 250)
  assert.equal(elapsed(game, team, 300), 250)
  assert.equal(getTimedCluesCountForTask(game, game.tasks[0], elapsed(game, team, 360)), 0)
  assert.equal(elapsed(game, team, 370), 250)
  assert.equal(elapsed(game, team, 420), 300)
  assert.equal(play(game, team, 1050).gameTeam.taskFailures.length, 0)
  const expired = play(game, team, 1120).gameTeam
  assert.equal(new Date(expired.taskFailures[0].failedAt).getTime(), at(1120).getTime())
  assert.equal(expired.timeAddings[0].time, -120)
})

test('заморозки не перекрываются; повтор запроса идемпотентен', () => {
  const game = gameFixture(), team = use(game, prepare(game), 'time_freeze').gameTeam
  assert.equal(use(game, team, 'time_freeze', 110).result.statusCode, 200)
  const denied = use(game, team, 'time_freeze', 110, { requestId: 'request-freeze-other' })
  assert.equal(denied.result.statusCode, 409)
  assert.equal(quantity(denied.gameTeam, 'time_freeze'), 1)
  const next = use(game, team, 'time_freeze', 220, { requestId: 'request-freeze-next' })
  assert.equal(next.result.statusCode, 200)
  assert.equal(elapsed(game, next.gameTeam, 300), 100)
})

test('экран агента учитывает заморозку до и после исходного лимита задания', () => {
  const game = gameFixture(), team = use(game, prepare(game), 'time_freeze', 950).gameTeam
  const params = { gameTeam: team, tasks: game.tasks, tasksCount: 2, assignedTaskIndexes: [0], breakDurationSeconds: 30, taskDurationSeconds: 1000 }
  assert.equal(resolveTeamBreakState({ ...params, now: at(1030) }).isTeamOnBreak, false)
  const active = resolveTeamAgentStatus({ ...params, now: at(1030) })
  assert.equal(active.status, 'active')
  assert.equal(active.currentTaskSeconds, 950)
  assert.deepEqual(resolveTeamBreakState({ ...params, now: at(1130) }), { isTeamOnBreak: true, breakTimeLeftSeconds: 20 })
})

test('при завершении во время заморозки результат учитывает только использованную часть', async () => {
  const game = gameFixture()
  let team = use(game, prepare(game), 'time_freeze', 100).gameTeam
  team = play(game, team, 110, { message: 'a' }).gameTeam
  team = play(game, team, 130, { message: 'b' }).gameTeam
  assert.equal(team.timeAddings[0].time, -30)
  const result = await computed(game, team)
  assert.equal(result.taskResults[0].realSeconds, 130)
  assert.equal(result.taskResults[0].seconds, 100)
  assert.equal(result.taskResults[0].timeBonusSeconds, 30)
  assert.equal(result.addingsSeconds, 0)
})

test('заморозка складывается с телепортом и платной подсказкой без заднего таймаута', () => {
  const game = gameFixture()
  game.clueEarlyAccessMode = 'penalty'; game.clueEarlyPenalty = 900
  let team = use(game, prepare(game), 'time_freeze', 400).gameTeam
  team = use(game, team, 'time_rewind', 410).gameTeam
  assert.equal(elapsed(game, team, 410), 100)
  team = play(game, team, 430, { action: 'forceClue', stageId: 'stage' }).gameTeam
  assert.equal(new Date(team.taskFailures[0].failedAt).getTime(), at(430).getTime())
  assert.equal(team.timeAddings.find((entry) => entry.source === 'item_time_freeze').time, -30)
})

test('щит срабатывает на штрафной код, сохраняет код и компенсирует штраф ровно один раз', async () => {
  const game = gameFixture()
  let team = use(game, prepare(game), 'penalty_shield').gameTeam
  team = play(game, team, 110, { message: 'trap' }).gameTeam
  assert.deepEqual(team.findedPenaltyCodes[0], ['trap'])
  assert.equal(stage(team).shields.length, 0)
  assert.equal(stage(team).waivedPenalties[0].key, 'code:trap')
  const repeat = play(game, team, 120, { message: 'TRAP' })
  assert.equal(repeat.result.statusCode, 400)
  assert.equal(repeat.gameTeam.timeAddings.length, 1)
  team = use(game, team, 'portal', 150).gameTeam
  const result = await computed(game, team)
  assert.equal(result.codePenaltySeconds, 120)
  assert.equal(result.addingsSeconds, -120)
  assert.equal(result.taskResults[0].itemBonusSeconds, 120)
  assert.equal(result.finalSeconds, result.baseSeconds + result.failurePenaltySeconds)
})

test('щит расходуется только на сформированный штраф за подбор и не защищает досрочную подсказку', () => {
  const game = gameFixture()
  let team = use(game, prepare(game), 'penalty_shield').gameTeam
  team = play(game, team, 110, { action: 'forceClue', stageId: 'stage' }).gameTeam
  assert.equal(stage(team).shields.length, 1)
  team = play(game, team, 120, { message: 'wrong' }).gameTeam
  assert.equal(stage(team).shields.length, 1)
  team = play(game, team, 130, { message: 'wrong' }).gameTeam
  assert.equal(stage(team).shields.length, 0)
  assert.deepEqual(team.wrongCodes[0], ['wrong', 'wrong'])
  assert.equal(team.timeAddings.find((entry) => entry.source === 'item_penalty_shield').time, -60)
})

test('неиспользованный щит остаётся на старом задании и не отменяет провал', async () => {
  const game = gameFixture()
  game.tasks[0].clues = []
  let team = use(game, prepare(game), 'penalty_shield').gameTeam
  team = play(game, team, 110, { action: 'failTask', stageId: 'stage' }).gameTeam
  team = play(game, team, 140).gameTeam
  assert.equal(team.activeNum, 1)
  assert.equal(stage(team).shields.length, 1)
  const result = await computed(game, team)
  assert.equal(result.taskResults[0].penaltySeconds, 180)
  assert.equal(result.addingsSeconds, 0)
})

test('ластик снимает выбранный штраф, не расходуется на подменённую или повторную цель', async () => {
  const game = gameFixture()
  let team = play(game, prepare(game), 90, { message: 'trap' }).gameTeam
  team = play(game, team, 95, { message: 'trap2' }).gameTeam
  const denied = use(game, team, 'penalty_erase', 100, { penaltyKey: 'code:absent' })
  assert.equal(denied.result.statusCode, 400)
  assert.equal(quantity(denied.gameTeam, 'penalty_erase'), 2)
  team = use(game, team, 'penalty_erase', 100, { penaltyKey: 'code:trap2' }).gameTeam
  assert.deepEqual(getClassicPenaltyCandidates(game, team, game.tasks[0], 0).map((entry) => entry.key), ['code:trap'])
  const stale = use(game, team, 'penalty_erase', 110, { penaltyKey: 'code:trap2', requestId: 'request-erase-again' })
  assert.equal(stale.result.statusCode, 400)
  assert.equal(quantity(stale.gameTeam, 'penalty_erase'), 1)
  assert.equal(use(game, team, 'penalty_erase', 110, { penaltyKey: 'code:trap' }).result.statusCode, 400)
  team = use(game, team, 'portal', 150).gameTeam
  const result = await computed(game, team)
  assert.equal(result.codePenaltySeconds, 210)
  assert.equal(result.addingsSeconds, -90)
  assert.equal(result.taskResults[0].itemBonusSeconds, 90)
  assert.equal(result.finalSeconds, result.baseSeconds + result.failurePenaltySeconds + 120)
})

test('ластик может снять отдельный штраф за подбор, уже отражённый в истории', () => {
  const game = gameFixture()
  let team = prepare(game)
  for (let index = 0; index < 4; index++) team = play(game, team, 50 + index, { message: 'wrong' }).gameTeam
  team = use(game, team, 'penalty_erase', 100, { penaltyKey: 'wrong:2' }).gameTeam
  assert.equal(team.wrongCodes[0].length, 4)
  assert.deepEqual(getClassicPenaltyCandidates(game, team, game.tasks[0], 0).map((entry) => entry.key), ['wrong:1'])
  assert.equal(team.timeAddings[0].time, -60)
})

test('отмычка закрывает только один обязательный код и не выдаёт награду за настоящий код', async () => {
  const game = gameFixture()
  let team = use(game, prepare(game), 'lockpick').gameTeam
  assert.equal(stage(team).virtualCodes, 1)
  assert.deepEqual(team.findedCodes[0], [])
  assert.equal(quantity(team, 'compass'), 2)
  assert.equal(team.endTime[0], null)
  team = play(game, team, 150, { message: 'b' }).gameTeam
  assert.equal(new Date(team.endTime[0]).getTime(), at(150).getTime())
  assert.equal(stage(team).outcome, 'completed')
  assert.equal(quantity(team, 'portal'), 3)
  const result = await computed(game, team)
  assert.equal(result.taskResults[0].virtualCodesCount, 1)
  assert.equal(result.taskResults[0].penaltySeconds, 0)
})

test('последний обязательный код можно закрыть отмычкой; повтор не расходует ещё предмет', () => {
  const game = gameFixture()
  let team = play(game, prepare(game), 90, { message: 'b' }).gameTeam
  team = use(game, team, 'lockpick').gameTeam
  assert.equal(stage(team).completionSource, 'lockpick')
  assert.equal(stage(team).outcome, 'completed')
  const repeat = use(game, team, 'lockpick', 140)
  assert.equal(repeat.result.statusCode, 200)
  assert.equal(quantity(repeat.gameTeam, 'lockpick'), 1)
  assert.equal(repeat.gameTeam.activeNum, 1)
})

test('портал завершает задание с обычным перерывом и наградой выполнения', async () => {
  const game = gameFixture(), before = prepare(game)
  let team = use(game, before, 'portal').gameTeam
  assert.equal(stage(team).completionSource, 'portal')
  assert.equal(stage(team).outcome, 'completed')
  assert.deepEqual(team.findedCodes[0], [])
  assert.equal(team.taskFailures.length, 0)
  assert.equal(quantity(team, 'portal'), 2)
  assert.equal(use(game, team, 'portal', 110, { requestId: 'request-new-portal' }).result.statusCode, 409)
  assert.equal(play(game, team, 129).gameTeam.activeNum, 0)
  team = play(game, team, 130).gameTeam
  assert.equal(team.activeNum, 1)
  assert.equal(new Date(team.startTime[1]).getTime(), at(130).getTime())
  const result = await computed(game, team)
  assert.equal(result.taskResults[0].seconds, 100)
  assert.equal(result.taskResults[0].completionSource, 'portal')
  assert.equal(result.taskResults[0].penaltySeconds, 0)
})

for (const definition of CLASSIC_ITEM_EFFECTS) test(`${definition.type}: права, текущий этап и ограничения проверяются сервером`, () => {
  const game = gameFixture(), team = prepare(game)
  for (const extra of [{ isCaptain: false }, { stageId: 'next' }]) {
    const denied = use(game, team, definition.type, 400, extra)
    assert.ok(denied.result.statusCode >= 400)
    assert.equal(quantity(denied.gameTeam, definition.type), 2)
  }
  const item = game.classicItems.find((entry) => entry.id === definition.type)
  item.effect.allowedStageIds = ['next']
  assert.match(getClassicItemUseBlockReason({ item, game, gameTeam: team, task: game.tasks[0], taskIndex: 0, stageId: 'stage', isCaptain: true, now: at(400) }), /нельзя применить/)
})

test('повторный старт убирает все эффекты предметов и сбрасывает прогресс', () => {
  const update = buildGameStartProgressUpdate({ gameTasksCount: 2, startImmediately: true, timeAddings: [{ source: 'item_time_freeze', time: -120 }, { source: 'item_penalty_shield', time: -60 }, { source: 'item_penalty_erase', time: -120 }, { name: 'Организатор', time: -30 }] })
  assert.deepEqual(update.timeAddings, [{ name: 'Организатор', time: -30 }])
  assert.equal(update.classicProgress, null)
})
