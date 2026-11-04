import test from 'node:test'
import assert from 'node:assert/strict'
import { getTaskDurationSeconds, getClueTimesSeconds, getTimedCluesCountForTask, getTaskTimingErrors, getRequiredCluesCountForTask, getTaskClueCountError } from '../helpers/taskTiming.js'
import { getGameValidationErrors } from '../helpers/isGameHaveErrors.js'
import normalizeGameForCabinet from '../helpers/normalizeGameForCabinet.js'
import { resolveClassicGame } from '../helpers/classicVariants.js'
import { resolveTeamBreakState } from '../helpers/agentGameStatus.js'
import buildGameResultComputed from '../server/buildGameResultComputed.js'
import { resolveClosedGameUpdateViolation } from '../helpers/closedGameUpdateProtection.js'
import { readFileSync } from 'node:fs'

const clues = (count) => Array.from({ length: count }, (_, index) => ({ clue: `Подсказка ${index + 1}` }))
const validGame = () => ({ type: 'classic', taskDuration: 3600, cluesDuration: 900, startingPlace: 'Старт', finishingPlace: 'Финиш', tasks: [{ _id: 'task', title: 'Задание', task: 'Описание', codes: ['code'], clues: [] }] })

test('индивидуальные лимиты 60/90/45 минут и наследование старого лимита', () => {
  const game = validGame()
  assert.deepEqual([{}, { taskDuration: 5400 }, { taskDuration: 2700 }].map((task) => getTaskDurationSeconds(game, task)), [3600, 5400, 2700])
  assert.equal(getTaskDurationSeconds(game, { taskDuration: null }), 3600)
  assert.equal(getTaskDurationSeconds({ ...game, type: 'photo' }, { taskDuration: 2700 }), 3600)
})

test('неравные общие интервалы, повтор последнего и собственное расписание задания', () => {
  const game = { type: 'classic', clueIntervals: [900, 600], cluesDuration: 1200 }
  assert.deepEqual(getClueTimesSeconds(game, { clues: clues(4) }), [900, 1500, 2100, 2700])
  assert.deepEqual(getClueTimesSeconds(game, { clues: clues(3), clueIntervals: [600, 1200, 300] }), [600, 1800, 2100])
  assert.deepEqual(getClueTimesSeconds(game, { clues: clues(3), clueIntervals: [] }), [])
  assert.equal(getTimedCluesCountForTask(game, { clues: clues(4) }, 1499), 1)
  assert.equal(getTimedCluesCountForTask(game, { clues: clues(4) }, 1500), 2)
})

test('старые равномерные подсказки сохраняют прежнее расписание', () => {
  assert.deepEqual(getClueTimesSeconds({ cluesDuration: 900 }, { clues: clues(3) }), [900, 1800, 2700])
  assert.deepEqual(getClueTimesSeconds({ cluesDuration: 0 }, { clues: clues(3) }), [])
  assert.deepEqual(getClueTimesSeconds({ type: 'photo', clueIntervals: [600], cluesDuration: 900 }, { clues: clues(2) }), [900, 1800])
})

test('неполный набор подсказок разрешён только с отдельной галочкой задания', () => {
  for (const count of [0, 1, 2]) {
    const game = validGame()
    game.tasks[0].clues = clues(count)
    assert.match(getGameValidationErrors(game).join(' '), new RegExp(`недостаточно подсказок \\(${count}/3\\)`))
    game.tasks[0].allowIncompleteClues = true
    assert.deepEqual(getGameValidationErrors(game), [])
  }
})

test('подсчёт обязательных подсказок использует собственный лимит и неравное расписание', () => {
  const game = validGame()
  assert.equal(getRequiredCluesCountForTask(game, {}), 3)
  assert.equal(getRequiredCluesCountForTask(game, { taskDuration: 5400 }), 5)
  assert.equal(getRequiredCluesCountForTask({ ...game, clueIntervals: [900, 600] }, {}), 5)
  assert.equal(getRequiredCluesCountForTask(game, { taskDuration: 2700, clueIntervals: [900, 600] }), 3)
  assert.equal(getRequiredCluesCountForTask(game, { taskDuration: 1500, clueIntervals: [900, 600] }), 1)
  assert.equal(getRequiredCluesCountForTask(game, { clueIntervals: [] }), 0)
  assert.equal(getRequiredCluesCountForTask({ ...game, taskDuration: 0 }, {}), 0)
  assert.equal(getRequiredCluesCountForTask({ ...game, cluesDuration: 0 }, {}), 0)
})

test('галочка относится к своему заданию и не отменяет остальные ошибки', () => {
  const game = validGame()
  game.tasks = [{ ...game.tasks[0], allowIncompleteClues: true }, { ...game.tasks[0], _id: 'second' }]
  assert.deepEqual(getGameValidationErrors(game), ['Задание 2: недостаточно подсказок (0/3) для заполнения времени задания.'])
  game.tasks[1].canceled = true
  assert.deepEqual(getGameValidationErrors(game), [])
  game.tasks[0].codes = []
  assert.match(getGameValidationErrors(game).join(' '), /не добавлен ни один код/)
  assert.equal(getTaskClueCountError(game, { ...game.tasks[0], allowIncompleteClues: 'true' }) !== null, true)
})

test('photo также поддерживает отключение проверки количества подсказок', () => {
  const game = { ...validGame(), type: 'photo' }
  assert.match(getGameValidationErrors(game).join(' '), /недостаточно подсказок/)
  game.tasks[0].allowIncompleteClues = true
  assert.deepEqual(getGameValidationErrors(game), [])
})

test('каждый вариант проверяется по расписанию этапа со своей галочкой', () => {
  const game = validGame()
  Object.assign(game.tasks[0], { taskDuration: 2700, clueIntervals: [900, 600], allowIncompleteClues: true, variantConfig: { enabled: true, mode: 'captain' }, variants: [{ id: 'path', title: 'Обход', content: { title: 'Путь', task: 'Описание', codes: ['other'], clues: clues(1), taskDuration: 1, clueIntervals: [] } }] })
  assert.match(getGameValidationErrors(game).join(' '), /вариант «Обход».*недостаточно подсказок \(1\/3\)/)
  game.tasks[0].variants[0].content.allowIncompleteClues = true
  assert.deepEqual(getGameValidationErrors(game), [])
})

test('клиентский редактор разрешает сохранить classic-задание без подсказок', () => {
  const source = readFileSync(new URL('../components/cabinet/app-router/GamesPageClient.js', import.meta.url), 'utf8')
  const validator = source.match(/^const validateTaskEditorRequirements =[\s\S]*?^}/m)?.[0]
  assert.ok(validator)
  const bindings = {
    getTaskDescriptionText: (task) => task.task || '', hasMeaningfulRichMarkup: () => false,
    getClueText: (clue) => clue.clue || '', sanitizeStringArray: (codes) => codes,
    getEmptyCodePositions: () => [], getRequiredMainCodesValidationError: () => null,
    getTaskDuplicateCodeConflicts: () => [], getDuplicateCodeKindsLabel: () => '',
  }
  const validate = new Function(...Object.keys(bindings), validator + ';return validateTaskEditorRequirements')(...Object.values(bindings))
  assert.deepEqual(validate(validGame()), [])
  assert.ok(validate({ ...validGame(), type: 'photo' }).some((issue) => /подсказку/.test(issue.message)))
  const photo = { ...validGame(), type: 'photo' }
  photo.tasks[0].allowIncompleteClues = true
  assert.deepEqual(validate(photo), [])
})

test('проверка отклоняет неверные интервалы и индивидуальную продолжительность', () => {
  for (const patch of [{ taskDuration: 0 }, { taskDuration: -1 }, { taskDuration: 1.5 }, { clueIntervals: [0] }, { clueIntervals: [-1] }, { clueIntervals: [1.5] }]) {
    const game = validGame()
    Object.assign(game.tasks[0], patch)
    assert.ok(getTaskTimingErrors(game).length > 0)
  }
  assert.deepEqual(getTaskTimingErrors({ ...validGame(), clueIntervals: [] }), [])
})

test('нормализация сохраняет наследование, выключение и собственные настройки', () => {
  const game = validGame()
  game.clueIntervals = [900, 600]
  game.tasks[0].taskDuration = 5400
  game.tasks[0].clueIntervals = []
  game.tasks[0].allowIncompleteClues = true
  const normalized = normalizeGameForCabinet(game)
  assert.deepEqual(normalized.clueIntervals, [900, 600])
  assert.equal(normalized.tasks[0].taskDuration, 5400)
  assert.deepEqual(normalized.tasks[0].clueIntervals, [])
  assert.equal(normalized.tasks[0].allowIncompleteClues, true)
  assert.equal(normalizeGameForCabinet(validGame()).tasks[0].allowIncompleteClues, false)
  assert.equal(normalizeGameForCabinet(validGame()).tasks[0].taskDuration, null)
})

test('выбранный вариант использует общий лимит и расписание своего этапа', () => {
  const game = validGame()
  Object.assign(game.tasks[0], { taskDuration: 5400, clueIntervals: [600, 900], variantConfig: { enabled: true }, variants: [{ id: 'path', content: { taskDuration: 1, clueIntervals: [1], codes: ['other'], clues: clues(2) } }] })
  const team = { classicProgress: { stages: [{ stageId: 'task', selectedVariantId: 'path' }] } }
  const resolved = resolveClassicGame(game, team)
  assert.equal(getTaskDurationSeconds(resolved, resolved.tasks[0]), 5400)
  assert.deepEqual(getClueTimesSeconds(resolved, resolved.tasks[0]), [600, 1500])
})

test('результат считает проваленные задания по их лимитам, без общего потолка', async () => {
  const game = validGame()
  game.tasks = [{ _id: 'first', taskDuration: 5400 }, { _id: 'second', taskDuration: 2700 }]
  game.result = { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [{ teamId: 'team', activeNum: 2, startTime: [new Date(0), new Date(6000_000)], endTime: [null, null], taskFailures: [{ taskIndex: 0, failedAt: new Date(5400_000) }, { taskIndex: 1, failedAt: new Date(8700_000) }] }] }
  const { computed } = await buildGameResultComputed({ game })
  assert.deepEqual(computed.teams[0].taskResults.map((task) => task.seconds), [5400, 2700])
  assert.equal(computed.teams[0].baseSeconds, 8100)
})

test('успешное длинное задание не обрезается общим лимитом и не получает штраф', async () => {
  const game = { ...validGame(), taskFailurePenalty: 60, tasks: [{ _id: 'long', taskDuration: 5400 }] }
  game.result = { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [{ teamId: 'team', activeNum: 1, startTime: [new Date(0)], endTime: [new Date(4500_000)] }] }
  const { computed } = await buildGameResultComputed({ game })
  assert.equal(computed.teams[0].taskResults[0].seconds, 4500)
  assert.equal(computed.teams[0].failurePenaltySeconds, 0)
  assert.equal(computed.teams[0].finalSeconds, 4500)
})

test('общий нулевой лимит старой игры не обнуляет время успешного задания', async () => {
  const game = { ...validGame(), taskDuration: 0, taskFailurePenalty: 60 }
  game.result = { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [{ teamId: 'team', activeNum: 1, startTime: [new Date(0)], endTime: [new Date(4500_000)] }] }
  const { computed } = await buildGameResultComputed({ game })
  assert.equal(computed.teams[0].taskResults[0].seconds, 4500)
  assert.equal(computed.teams[0].failurePenaltySeconds, 0)
})

test('агент не объявляет перерыв до истечения индивидуального лимита', () => {
  const params = { gameTeam: { activeNum: 0, startTime: [new Date(0)] }, tasks: [{ taskDuration: 5400 }], tasksCount: 1, taskDurationSeconds: 3600, breakDurationSeconds: 300 }
  assert.equal(resolveTeamBreakState({ ...params, now: new Date(3700_000) }).isTeamOnBreak, false)
  assert.deepEqual(resolveTeamBreakState({ ...params, now: new Date(5500_000) }), { isTeamOnBreak: true, breakTimeLeftSeconds: 200 })
})

test('закрытая игра защищена от изменения расписаний и лимитов', () => {
  const game = { ...validGame(), status: 'closed', clueIntervals: [900, 600] }
  assert.ok(resolveClosedGameUpdateViolation({ existingGame: game, updateData: { clueIntervals: [600] } }))
  assert.ok(resolveClosedGameUpdateViolation({ existingGame: game, updateData: { tasks: [{ ...game.tasks[0], taskDuration: 5400 }] } }))
  const old = { ...validGame(), status: 'closed' }
  assert.equal(resolveClosedGameUpdateViolation({ existingGame: old, updateData: { clueIntervals: null } }), null)
  assert.ok(resolveClosedGameUpdateViolation({ existingGame: old, updateData: { tasks: [{ ...old.tasks[0], allowIncompleteClues: true }] } }))
})
