import test from 'node:test'
import assert from 'node:assert/strict'
import { runClassicVariants } from '../server/classicVariantsEngine.js'
import { getClassicVariantChoices, resolveClassicGame, validateClassicVariants } from '../helpers/classicVariants.js'
import sanitizeGameForPublicRead from '../helpers/sanitizeGameForPublicRead.js'
import buildGameResultComputed from '../server/buildGameResultComputed.js'
import processClassicVariants from '../server/processClassicVariants.js'

const at = (seconds) => new Date(Date.UTC(2026, 8, 22, 12, 0, seconds))
const makeGame = () => ({ type: 'classic', status: 'started', taskDuration: 60, breakDuration: 10, cluesDuration: 10,
  classicItems: [{ id: 'coin', title: 'Жетон', kind: 'stackable' }],
  tasks: [
    { _id: 'one', codes: ['done'], bonusCodes: [{ code: 'coins', bonus: 0 }], itemRewards: { codes: [{ category: 'bonus', code: 'coins', items: [{ itemId: 'coin', quantity: 3 }] }] } },
    { _id: 'two', codes: ['default-code'], variantConfig: { enabled: true, mode: 'captain' }, variants: [
      { id: 'b', title: 'Служебный', conditions: { mode: 'all', rules: [{ type: 'item', itemId: 'coin', quantity: 2 }] }, consumeItems: [{ itemId: 'coin', quantity: 2 }], content: { codes: ['b-code'], clues: [{ clue: 'Подсказка' }] } },
      { id: 'c', title: 'Подземный', conditions: { mode: 'all', rules: [] }, consumeItems: [{ itemId: 'coin', quantity: 3 }], content: { codes: ['c-code'] } },
    ] },
    { _id: 'three', codes: ['finish'] },
  ],
})
const play = (game, team = {}, seconds = 0, extra = {}) => runClassicVariants({ game, gameTeam: team, now: at(seconds), isCaptain: true, ...extra })
const prepared = (game) => {
  let team = play(game).gameTeam
  team = play(game, team, 1, { message: 'COINS' }).gameTeam
  return play(game, team, 2, { message: 'done' }).gameTeam
}

test('валидный сценарий, ссылки вперёд и случайный порядок', () => {
  const game = makeGame()
  assert.deepEqual(validateClassicVariants(game), [])
  assert.match(validateClassicVariants({ ...game, taskDistributionMode: 'random' }).join(), /линейный/)
  game.tasks[1].variants[0].conditions.rules = [{ type: 'outcome', stageId: 'three', outcome: 'completed' }]
  assert.match(validateClassicVariants(game).join(), /предыдущий/)
})
test('награждение без временного бонуса и защита повторного ввода', () => {
  const game = makeGame()
  const team = play(game, play(game).gameTeam, 1, { message: 'coins' }).gameTeam
  const repeated = play(game, team, 2, { message: 'coins' })
  assert.equal(repeated.gameTeam.classicProgress.inventory[0].quantity, 3)
  assert.equal(repeated.result.statusCode, 400)
})
test('выбор расходует только выбранную цену и не сбрасывает таймер', () => {
  const game = makeGame()
  const choosing = play(game, prepared(game), 15).gameTeam
  assert.equal(choosing.activeNum, 1)
  assert.equal(new Date(choosing.startTime[1]).getTime(), at(12).getTime())
  assert.deepEqual(getClassicVariantChoices(game, choosing, 1).map((v) => v.id), ['b', 'c'])
  const selected = play(game, choosing, 25, { action: 'selectVariant', stageId: 'two', variantId: 'b' }).gameTeam
  assert.equal(selected.classicProgress.inventory[0].quantity, 1)
  assert.equal(new Date(selected.startTime[1]).getTime(), at(12).getTime())
  assert.deepEqual(resolveClassicGame(game, selected).tasks[1].codes, ['b-code'])
  assert.equal(play(game, selected, 26, { action: 'selectVariant', stageId: 'two', variantId: 'b' }).gameTeam.classicProgress.inventory[0].quantity, 1)
  assert.equal(play(game, selected, 26, { action: 'selectVariant', stageId: 'two', variantId: 'c' }).result.statusCode, 409)
})
test('таймаут без выбора не назначает запасной вариант и не расходует предметы', () => {
  const game = makeGame()
  const result = play(game, prepared(game), 72, { action: 'selectVariant', stageId: 'two', variantId: 'b' })
  assert.equal(result.result.statusCode, 409)
  assert.equal(result.gameTeam.classicProgress.inventory[0].quantity, 3)
  assert.equal(result.gameTeam.classicProgress.stages[1].selectedVariantId, null)
  assert.equal(result.gameTeam.classicProgress.stages[1].outcome, 'timeout')
  assert.equal(result.gameTeam.endTime[1], null)
  assert.equal(new Date(result.gameTeam.taskFailures[0].failedAt).getTime(), at(72).getTime())
})
test('до выбора нельзя вводить код запасного задания', () => {
  const game = makeGame()
  const choosing = play(game, prepared(game), 13).gameTeam
  assert.equal(play(game, choosing, 14, { message: 'default-code' }).result.statusCode, 409)
  assert.deepEqual(resolveClassicGame(game, choosing).tasks[1].codes, undefined)
})
test('приоритет автоматического назначения и запасной путь', () => {
  const game = makeGame(); game.tasks[1].variantConfig.mode = 'auto'
  const team = play(game, prepared(game), 13).gameTeam
  assert.equal(team.classicProgress.stages[1].selectedVariantId, 'b')
  const empty = play(game, play(game).gameTeam, 1, { message: 'done' }).gameTeam
  assert.equal(play(game, empty, 11).gameTeam.classicProgress.stages[1].selectedVariantId, 'default')
})
test('таймауты при отсутствии клиента сохраняют расчётные времена', () => {
  const game = makeGame()
  const team = play(game, prepared(game), 150).gameTeam
  assert.equal(team.activeNum, 3)
  assert.equal(new Date(team.startTime[2]).getTime(), at(82).getTime())
})
test('права капитана, слив без выбора и одноразовая общая награда', () => {
  const game = makeGame()
  game.tasks[1].outcomeRewards = { captain_failed: [{ itemId: 'coin', quantity: 2 }] }
  const choosing = play(game, prepared(game), 13).gameTeam
  assert.equal(play(game, choosing, 14, { isCaptain: false, action: 'selectVariant', stageId: 'two', variantId: 'b' }).result.statusCode, 403)
  const failed = play(game, choosing, 14, { action: 'failTask' }).gameTeam
  assert.equal(failed.endTime[1], null)
  assert.equal(failed.classicProgress.inventory[0].quantity, 5)
  assert.equal(play(game, failed, 15).gameTeam.classicProgress.inventory[0].quantity, 5)
})
test('выбор при любом условии всё равно требует полный расход', () => {
  const game = makeGame(); game.tasks[1].variants[0].conditions = { mode: 'any', rules: [] }
  assert.deepEqual(getClassicVariantChoices(game, {}, 1).map((v) => v.id), ['default'])
})
test('скрытые варианты и награды не раскрываются публичной игрой', () => {
  const safe = sanitizeGameForPublicRead(makeGame())
  assert.deepEqual(safe.classicItems, [])
  assert.deepEqual(safe.tasks[1].variants, [])
  assert.equal(safe.tasks[0].itemRewards, null)
  assert.ok(!JSON.stringify(safe).includes('b-code'))
})
test('последний код и награда выполнения выдаются до следующего выбора', () => {
  const game = makeGame(); game.breakDuration = 0
  game.tasks[0].itemRewards = { codes: [{ category: 'main', code: 'done', items: [{ itemId: 'coin', quantity: 1 }] }], completed: [{ itemId: 'coin', quantity: 2 }] }
  const team = play(game, play(game).gameTeam, 1, { message: 'done' }).gameTeam
  assert.equal(team.classicProgress.inventory[0].quantity, 3)
  assert.equal(getClassicVariantChoices(game, team, 1).length, 2)
})

test('результат считает три этапа, бонусы только выбранного варианта', async () => {
  const game = makeGame()
  game.tasks[1].variants[0].content.bonusCodes = [{ code: 'extra', bonus: 5 }]
  let team = play(game, prepared(game), 13).gameTeam
  team = play(game, team, 14, { action: 'selectVariant', stageId: 'two', variantId: 'b' }).gameTeam
  team = play(game, team, 15, { message: 'extra' }).gameTeam
  team = play(game, team, 16, { message: 'b-code' }).gameTeam
  team = play(game, team, 26).gameTeam
  team = play(game, team, 27, { message: 'finish' }).gameTeam
  game.result = { teams: [{ _id: 't', name: 'Команда' }], teamsUsers: [{ teamId: 't' }], gameTeams: [{ ...team, teamId: 't' }] }
  const result = await buildGameResultComputed({ game })
  const computed = result.computed.teams[0]
  assert.equal(computed.taskResults.length, 3)
  assert.equal(computed.taskResults[1].variantId, 'b')
  assert.equal(computed.codeBonusSeconds, 5)
  assert.equal(computed.baseSeconds, 7)
})
test('параллельные подтверждения сохраняют один расход под блокировкой', async () => {
  const game = makeGame()
  let document = { ...play(game, prepared(game), 13).gameTeam, _id: 'progress' }
  const model = {
    findOneAndUpdate(filter, update) {
      return { lean: async () => {
        const current = document.gameProcessLock
        if (filter.$or) {
          if (current && new Date(current.expiresAt) > new Date()) return null
        } else if (current?.token !== filter['gameProcessLock.token'] || new Date(current.expiresAt) <= filter['gameProcessLock.expiresAt'].$gt) return null
        document = { ...document, ...structuredClone(update.$set) }
        return structuredClone(document)
      } }
    },
    async updateOne(filter) { if (document.gameProcessLock?.token === filter['gameProcessLock.token']) delete document.gameProcessLock },
  }
  const input = { game, gameTeam: document, gamesTeamsModel: model, action: 'selectVariant', stageId: 'two', variantId: 'b', isCaptain: true, now: at(14) }
  const results = await Promise.all([processClassicVariants(input), processClassicVariants(input)])
  assert.ok(results.every((result) => result.result.statusCode === 200))
  assert.equal(document.classicProgress.inventory[0].quantity, 1)
  assert.equal(document.classicProgress.history.filter((event) => event.type === 'variant_selected' && event.stageId === 'two').length, 1)
})
test('уникальные предметы не накапливаются и выдаются снова после расхода', () => {
  const game = makeGame(); game.classicItems[0].kind = 'unique'
  game.tasks[0].itemRewards.codes[0].items[0].quantity = 1
  game.tasks[0].itemRewards.completed = [{ itemId: 'coin', quantity: 1 }]
  game.tasks[1].variants = [game.tasks[1].variants[0]]
  game.tasks[1].variants[0].conditions.rules[0].quantity = 1
  game.tasks[1].variants[0].consumeItems[0].quantity = 1
  game.tasks[1].variants[0].content.itemRewards = { completed: [{ itemId: 'coin', quantity: 1 }] }
  let team = prepared(game)
  assert.equal(team.classicProgress.inventory[0].quantity, 1)
  team = play(game, team, 13).gameTeam
  assert.equal(team.classicProgress.inventory[0].quantity, 0)
  team = play(game, team, 14, { message: 'b-code' }).gameTeam
  assert.equal(team.classicProgress.inventory[0].quantity, 1)
})

test('все/любое, код, исход и отрицательное условие учитывают прошлый вариант', () => {
  const game = makeGame()
  const variant = game.tasks[1].variants[0]
  variant.consumeItems = []
  variant.conditions.rules = [
    { type: 'code', stageId: 'one', variantId: 'default', category: 'bonus', code: 'COINS' },
    { type: 'outcome', stageId: 'one', outcome: 'completed' },
    { type: 'item', itemId: 'coin', quantity: 4, absent: true },
  ]
  const team = prepared(game)
  assert.ok(getClassicVariantChoices(game, team, 1).some((v) => v.id === 'b'))
  variant.conditions.rules[0].absent = true
  assert.ok(!getClassicVariantChoices(game, team, 1).some((v) => v.id === 'b'))
  variant.conditions.mode = 'any'
  assert.ok(getClassicVariantChoices(game, team, 1).some((v) => v.id === 'b'))
})

test('отменённый этап пропускается без наград, старый запрос не меняет новый', () => {
  const game = makeGame()
  game.tasks[1].canceled = true
  game.tasks[1].outcomeRewards = { completed: [{ itemId: 'coin', quantity: 50 }] }
  const result = play(game, prepared(game), 13, { message: 'finish', stageId: 'two' })
  assert.equal(result.result.statusCode, 409)
  assert.equal(result.gameTeam.activeNum, 2)
  assert.equal(result.gameTeam.classicProgress.inventory[0].quantity, 3)
  assert.equal(result.gameTeam.endTime[2], null)
})

test('подсказки отсчитываются с начала выбора; ранний перерыв сохраняет исход', () => {
  const game = makeGame()
  let team = play(game, prepared(game), 13).gameTeam
  team = play(game, team, 25, { action: 'selectVariant', stageId: 'two', variantId: 'b' }).gameTeam
  const clue = play(game, team, 25, { action: 'forceClue' })
  assert.equal(clue.result.statusCode, 409)
  team = play(game, team, 26, { action: 'failTask' }).gameTeam
  assert.equal(team.classicProgress.stages[1].outcome, 'captain_failed')
  team = play(game, team, 27, { action: 'finishBreak' }).gameTeam
  assert.equal(team.activeNum, 2)
  assert.equal(new Date(team.startTime[2]).getTime(), at(27).getTime())
})

test('истекшая блокировка запрещает запись рассчитанного расхода', async () => {
  const game = makeGame()
  const original = { ...play(game, prepared(game), 13).gameTeam, _id: 'progress' }
  let writes = 0
  const model = {
    findOneAndUpdate(filter, update) { return { lean: async () => {
      if (filter.$or) return { ...original, ...update.$set }
      writes++
      return null
    } } },
    async updateOne() {},
  }
  await assert.rejects(processClassicVariants({ game, gameTeam: original, gamesTeamsModel: model, isCaptain: true, action: 'selectVariant', stageId: 'two', variantId: 'b', now: at(14) }), /Блокировка/)
  assert.equal(writes, 1)
  assert.equal(original.classicProgress.inventory[0].quantity, 3)
})
