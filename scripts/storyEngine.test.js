import test from 'node:test'
import assert from 'node:assert/strict'

import {
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
