import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getGameValidationErrors,
  getStoryReachabilityReport,
  getStoryValidationErrors,
} from '../helpers/isGameHaveErrors.js'

const buildValidStoryGame = () => ({
  type: 'story',
  startingPlace: 'Старт',
  finishingPlace: 'Финиш',
  tasks: [],
  storyItems: [{ id: 'key', title: 'Ключ' }],
  storyNodes: [
    {
      id: 'start',
      title: 'Стартовая локация',
      visibility: { startVisible: true },
      codes: [
        {
          id: 'finish-code',
          code: 'FINISH',
          type: 'complete',
          endingId: 'success',
        },
      ],
      actions: [],
      clues: [],
    },
  ],
  storyEndings: [{ id: 'success', title: 'Успех', type: 'success' }],
})

test('valid story game does not require classic tasks', () => {
  assert.deepEqual(getGameValidationErrors(buildValidStoryGame()), [])
})

test('story validation requires a start node and an ending', () => {
  const game = buildValidStoryGame()
  game.storyNodes[0].visibility.startVisible = false
  game.storyEndings = []

  const errors = getStoryValidationErrors(game)

  assert.ok(errors.some((error) => error.includes('стартовую')))
  assert.ok(errors.some((error) => error.includes('концовку')))
})

test('story validation reports broken references and duplicate codes', () => {
  const game = buildValidStoryGame()
  game.storyNodes[0].visibility.requiredItemIds = ['missing-item']
  game.storyNodes[0].codes.push({
    id: 'second-code',
    code: 'finish',
    unlocksNodeIds: ['missing-node'],
  })

  const errors = getStoryValidationErrors(game)

  assert.ok(errors.some((error) => error.includes('missing-item')))
  assert.ok(errors.some((error) => error.includes('missing-node')))
  assert.ok(errors.some((error) => error.includes('дублируется')))
})

test('story reachability follows items, completed nodes and ending triggers', () => {
  const game = buildValidStoryGame()
  game.storyNodes[0].codes[0] = {
    id: 'open-vault',
    code: 'OPEN',
    grantsItemIds: ['key'],
    completesNode: true,
  }
  game.storyNodes.push({
    id: 'vault',
    title: 'Хранилище',
    visibility: {
      requiredNodeIds: ['start'],
      requiredItemIds: ['key'],
      requiredInputMode: 'all',
    },
    codes: [
      {
        id: 'finish-code',
        code: 'FINISH',
        completesNode: true,
        endingId: 'success',
      },
    ],
    actions: [],
    clues: [],
  })

  const report = getStoryReachabilityReport(game)

  assert.deepEqual(report.unreachableNodeIds, [])
  assert.deepEqual(report.unreachableEndingIds, [])
  assert.deepEqual(getStoryValidationErrors(game), [])
})

test('story validation rejects disconnected cycles and unreachable endings', () => {
  const game = buildValidStoryGame()
  game.storyNodes[0].codes[0].endingId = null
  game.storyNodes.push(
    {
      id: 'cycle-a',
      title: 'Цикл A',
      visibility: { requiredNodeIds: ['cycle-b'] },
      codes: [{ id: 'cycle-a-code', code: 'A', completesNode: true }],
      actions: [],
      clues: [],
    },
    {
      id: 'cycle-b',
      title: 'Цикл B',
      visibility: { requiredNodeIds: ['cycle-a'] },
      codes: [
        {
          id: 'cycle-b-code',
          code: 'B',
          completesNode: true,
          endingId: 'success',
        },
      ],
      actions: [],
      clues: [],
    },
  )

  const errors = getStoryValidationErrors(game)

  assert.ok(errors.some((error) => error.includes('cycle-a, cycle-b')))
  assert.ok(errors.some((error) => error.includes('Недостижимые концовки')))
})

test('story validation requires globally unique effect identifiers', () => {
  const game = buildValidStoryGame()
  game.storyNodes.push({
    id: 'second',
    title: 'Вторая локация',
    visibility: { startVisible: true },
    codes: [{ id: 'finish-code', code: 'SECOND', completesNode: true }],
    actions: [],
    clues: [],
  })

  const errors = getStoryValidationErrors(game)

  assert.ok(
    errors.some((error) =>
      error.includes('глобальные идентификаторы кодов story-квеста'),
    ),
  )
})

test('story reachability accounts for prequel unlock effects', () => {
  const game = buildValidStoryGame()
  game.storyNodes[0].codes[0].endingId = null
  game.storyNodes.push({
    id: 'secret',
    title: 'Секретная локация',
    visibility: { hiddenUntilUnlocked: true },
    codes: [
      {
        id: 'secret-finish',
        code: 'SECRET',
        completesNode: true,
        endingId: 'success',
      },
    ],
    actions: [],
    clues: [],
  })
  game.prequel = {
    enabled: true,
    bonusCodes: [
      {
        storyEffects: [{ type: 'unlock_node', nodeId: 'secret' }],
      },
    ],
  }

  assert.deepEqual(getStoryValidationErrors(game), [])
})

test('story reachability does not apply an effect with unavailable consumed item', () => {
  const game = buildValidStoryGame()
  game.storyNodes[0].codes = []
  game.storyNodes[0].actions = [
    {
      id: 'locked-action',
      label: 'Открыть без ключа',
      consumesItemIds: ['key'],
      unlocksNodeIds: ['finish'],
    },
  ]
  game.storyNodes.push({
    id: 'finish',
    title: 'Финал',
    visibility: { hiddenUntilUnlocked: true },
    codes: [
      {
        id: 'finish-code',
        code: 'FINISH',
        completesNode: true,
        endingId: 'success',
      },
    ],
    actions: [],
    clues: [],
  })

  const report = getStoryReachabilityReport(game)

  assert.deepEqual(report.unreachableNodeIds, ['finish'])
  assert.deepEqual(report.unreachableEndingIds, ['success'])
})

test('manual-only story ending does not require a player path', () => {
  const game = buildValidStoryGame()
  game.storyNodes[0].codes[0].endingId = null
  game.storyEndings[0].manualOnly = true

  const report = getStoryReachabilityReport(game)

  assert.deepEqual(report.unreachableEndingIds, [])
  assert.deepEqual(getStoryValidationErrors(game), [])
})

const buildValidInvestigationGame = () => ({
  type: 'story',
  storyConfig: {
    experienceMode: 'investigation',
    investigation: { startNodeId: 'reception', deadlineMinutes: 120 },
  },
  storyItems: [],
  storyNodes: [
    {
      id: 'reception',
      title: 'Приёмная',
      visibility: { startVisible: true },
      codes: [],
      actions: [],
      clues: [],
    },
  ],
  storyCharacters: [
    { id: 'suspect', title: 'Подозреваемый', startVisible: true },
  ],
  storyTopics: [
    { id: 'timeline', title: 'Хронология', startVisible: true },
    { id: 'accuse', title: 'Обвинение', startVisible: false },
  ],
  storyEvidence: [
    { id: 'log', title: 'Журнал', isKey: true, tags: ['time'] },
  ],
  storyInteractions: [
    {
      id: 'inspect-log',
      kind: 'examine',
      locationId: 'reception',
      label: 'Изучить журнал',
      responseRich: '<p>Найдена запись.</p>',
      timeCostMinutes: 10,
      conditions: {},
      effects: { grantsEvidenceIds: ['log'] },
    },
  ],
  storyEndings: [
    { id: 'solved', title: 'Решено', type: 'success', conditions: {} },
    { id: 'failed', title: 'Ошибка', type: 'failed', conditions: {} },
    { id: 'timeout', title: 'Время вышло', type: 'failed', conditions: {} },
  ],
  storyAccusation: {
    enabled: true,
    requiredNodeId: 'reception',
    unlockTopicId: 'accuse',
    availability: { minKeyEvidence: 1 },
    culpritCharacterIds: ['suspect'],
    motives: [{ id: 'motive', title: 'Мотив' }],
    correctCulpritId: 'suspect',
    correctMotiveId: 'motive',
    outcomes: [
      {
        id: 'correct',
        endingId: 'solved',
        priority: 10,
        conditions: {
          culprit: 'correct',
          motive: 'correct',
          requiredEvidenceIds: ['log'],
        },
      },
    ],
    fallbackEndingId: 'failed',
    timeoutEndingId: 'timeout',
  },
})

test('valid investigation passes additive story validation', () => {
  assert.deepEqual(getStoryValidationErrors(buildValidInvestigationGame()), [])
})

test('investigation validation reports broken references and invalid time', () => {
  const game = buildValidInvestigationGame()
  game.storyConfig.investigation.startNodeId = 'missing-node'
  game.storyInteractions[0].timeCostMinutes = -1
  game.storyInteractions[0].effects.grantsEvidenceIds = ['missing-evidence']
  game.storyAccusation.correctMotiveId = 'missing-motive'

  const errors = getStoryValidationErrors(game)
  assert.ok(errors.some((error) => error.includes('стартовую локацию')))
  assert.ok(errors.some((error) => error.includes('неотрицательным числом')))
  assert.ok(errors.some((error) => error.includes('missing-evidence')))
  assert.ok(errors.some((error) => error.includes('правильный мотив')))
})
