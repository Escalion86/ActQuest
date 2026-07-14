import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyStoryAction,
  applyStoryCode,
  getAvailableStoryNodes,
  grantStoryItem,
} from '../server/storyEngine.js'

const buildGame = () => ({
  storyItems: [
    { id: 'key', title: 'Ключ' },
  ],
  storyNodes: [
    {
      id: 'start',
      title: 'Старт',
      visibility: { startVisible: true },
    },
    {
      id: 'branch-a',
      title: 'Ветка A',
      visibility: { startVisible: false },
    },
    {
      id: 'branch-b',
      title: 'Ветка B',
      visibility: { startVisible: false },
    },
    {
      id: 'any-node',
      title: 'Любой вход',
      visibility: {
        requiredNodeIds: ['branch-a', 'branch-b'],
        requiredInputMode: 'any',
      },
    },
    {
      id: 'count-node',
      title: 'Два входа из трех',
      visibility: {
        requiredNodeIds: ['start', 'branch-a', 'branch-b'],
        requiredInputMode: 'count',
        requiredInputCount: 2,
      },
    },
    {
      id: 'item-node',
      title: 'Вход от предмета',
      visibility: {
        requiredItemIds: ['key'],
        requiredInputMode: 'any',
      },
    },
  ],
})

const availableIds = (game, progress) =>
  getAvailableStoryNodes(game, progress).map((node) => node.id)

test('story location with any input opens after one incoming location is completed', () => {
  const game = buildGame()
  const progress = {
    status: 'in_progress',
    completedNodeIds: ['branch-a'],
  }

  assert.ok(availableIds(game, progress).includes('any-node'))
})

test('story location with count input opens after enough incoming inputs are enabled', () => {
  const game = buildGame()
  const progress = {
    status: 'in_progress',
    completedNodeIds: ['start', 'branch-a'],
  }

  assert.ok(availableIds(game, progress).includes('count-node'))
})

test('story item edge input opens a location when the item is active', () => {
  const game = buildGame()
  const grantResult = grantStoryItem({
    game,
    progress: { status: 'in_progress' },
    itemId: 'key',
    now: new Date('2026-07-02T00:00:00.000Z'),
  })

  assert.equal(grantResult.applied, true)
  assert.ok(availableIds(game, grantResult.progress).includes('item-node'))
})

test('story location without inputs stays hidden until explicitly unlocked', () => {
  const game = buildGame()
  const progress = { status: 'in_progress', unlockedNodeIds: ['start'] }

  assert.equal(availableIds(game, progress).includes('branch-a'), false)
  assert.equal(availableIds(game, progress).includes('branch-b'), false)
})

test('story bonus code is not consumed when required item is missing', () => {
  const game = {
    storyItems: [{ id: 'key' }],
    storyNodes: [
      {
        id: 'start',
        visibility: { startVisible: true },
        codes: [
          {
            id: 'bonus-with-key',
            code: 'BONUS',
            type: 'bonus',
            requiredItemIds: ['key'],
            scoreBonus: 5,
            completesNode: false,
          },
        ],
      },
    ],
  }
  const progress = { status: 'in_progress', unlockedNodeIds: ['start'] }

  const result = applyStoryCode({
    game,
    progress,
    nodeId: 'start',
    code: 'BONUS',
  })

  assert.equal(result.applied, false)
  assert.equal(result.reason, 'required_items_missing')
  assert.deepEqual(result.progress.usedBonusCodeIds, [])
  assert.deepEqual(result.progress.usedCodeIds, [])
  assert.deepEqual(result.progress.history, [])
})

test('story action is one-time by default and cannot farm score', () => {
  const game = {
    storyNodes: [
      {
        id: 'start',
        visibility: { startVisible: true },
        actions: [
          {
            id: 'score-action',
            label: 'Получить баллы',
            scoreBonus: 3,
            completesNode: false,
          },
        ],
      },
    ],
  }
  const progress = { status: 'in_progress', unlockedNodeIds: ['start'] }

  const first = applyStoryAction({
    game,
    progress,
    nodeId: 'start',
    actionId: 'score-action',
  })
  const second = applyStoryAction({
    game,
    progress: first.progress,
    nodeId: 'start',
    actionId: 'score-action',
  })

  assert.equal(first.applied, true)
  assert.equal(first.progress.score, 3)
  assert.deepEqual(first.progress.usedActionIds, ['score-action'])
  assert.equal(second.applied, false)
  assert.equal(second.reason, 'action_already_used')
  assert.equal(second.progress.score, 3)
})

test('story effects roll back when ending requirements are not met', () => {
  const game = {
    storyEndings: [
      {
        id: 'high-score-ending',
        type: 'success',
        conditions: { minScore: 10 },
      },
    ],
    storyNodes: [
      {
        id: 'start',
        visibility: { startVisible: true },
        codes: [
          {
            id: 'ending-code',
            code: 'END',
            type: 'effect',
            scoreBonus: 1,
            endingId: 'high-score-ending',
            completesNode: false,
          },
        ],
      },
    ],
  }
  const progress = { status: 'in_progress', unlockedNodeIds: ['start'] }

  const result = applyStoryCode({
    game,
    progress,
    nodeId: 'start',
    code: 'END',
  })

  assert.equal(result.applied, false)
  assert.equal(result.reason, 'ending_score_too_low')
  assert.equal(result.progress.score, 0)
  assert.equal(result.progress.status, 'in_progress')
  assert.deepEqual(result.progress.usedCodeIds, [])
  assert.deepEqual(result.progress.history, [])
})
