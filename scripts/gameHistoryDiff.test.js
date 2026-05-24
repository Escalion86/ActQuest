import test from 'node:test'
import assert from 'node:assert/strict'

import buildGameHistoryDiff from '../server/gameHistory/buildGameHistoryDiff.js'

test('builds diff entries for primitive and collection changes', () => {
  const diff = buildGameHistoryDiff({
    before: {
      game: {
        name: 'Old name',
        status: 'active',
        prices: [{ id: 'p1', price: 1000 }],
      },
      gameTeams: [{ _id: 'gt-1', teamId: 'team-1' }],
    },
    after: {
      game: {
        name: 'New name',
        status: 'started',
        prices: [
          { id: 'p1', price: 1000 },
          { id: 'p2', price: 1200 },
        ],
      },
      gameTeams: [
        { _id: 'gt-1', teamId: 'team-1' },
        { _id: 'gt-2', teamId: 'team-2' },
      ],
    },
  })

  assert.deepEqual(diff, [
    {
      path: 'game.name',
      label: 'Название игры',
      kind: 'changed',
      beforeValue: 'Old name',
      afterValue: 'New name',
    },
    {
      path: 'game.status',
      label: 'Статус игры',
      kind: 'changed',
      beforeValue: 'active',
      afterValue: 'started',
    },
    {
      path: 'game.prices',
      label: 'Цены',
      kind: 'changed',
      beforeValue: [{ id: 'p1', price: 1000 }],
      afterValue: [
        { id: 'p1', price: 1000 },
        { id: 'p2', price: 1200 },
      ],
    },
    {
      path: 'gameTeams',
      label: 'Команды в игре',
      kind: 'changed',
      beforeValue: [{ teamId: 'team-1' }],
      afterValue: [
        { teamId: 'team-1' },
        { teamId: 'team-2' },
      ],
    },
  ])
})

test('returns empty diff for identical normalized states', () => {
  const state = {
    game: {
      name: 'Same',
      status: 'active',
    },
    gameTeams: [],
  }

  assert.deepEqual(
    buildGameHistoryDiff({
      before: state,
      after: structuredClone(state),
    }),
    [],
  )
})

test('ignores technical ids and timestamps after display sanitization', async () => {
  const { default: sanitizeGameHistoryDisplayState } = await import(
    '../server/gameHistory/sanitizeGameHistoryDisplayState.js'
  )

  const before = sanitizeGameHistoryDisplayState({
    game: {
      _id: 'game-1',
      name: 'Old name',
      updatedAt: '2026-05-24T10:00:00.000Z',
      storyConfig: {
        _id: 'story-config-1',
        showInventory: true,
      },
      agentNotifications: {
        _id: 'agent-notifications-1',
        onCurrentTask: true,
      },
      finances: [
        {
          _id: 'finance-subdoc-1',
          id: 'finance-1',
          sum: 100,
        },
      ],
    },
    gameTeams: [],
  })

  const after = sanitizeGameHistoryDisplayState({
    game: {
      _id: 'game-1',
      name: 'New name',
      updatedAt: '2026-05-24T10:05:00.000Z',
      storyConfig: {
        _id: 'story-config-2',
        showInventory: true,
      },
      agentNotifications: {
        _id: 'agent-notifications-2',
        onCurrentTask: true,
      },
      finances: [
        {
          _id: 'finance-subdoc-2',
          id: 'finance-1',
          sum: 100,
        },
      ],
    },
    gameTeams: [],
  })

  assert.deepEqual(buildGameHistoryDiff({ before, after }), [
    {
      path: 'game.name',
      label: 'Название игры',
      kind: 'changed',
      beforeValue: 'Old name',
      afterValue: 'New name',
    },
  ])
})

test('drops nested technical churn from raw history states and keeps only meaningful game changes', () => {
  const before = {
    game: {
      name: 'Тайна перевала Дятлова',
      updatedAt: '2026-05-24T10:00:00.000Z',
      agentNotifications: {
        _id: 'agent-notifications-1',
        enabled: true,
      },
      storyConfig: {
        _id: 'story-config-1',
        mode: 'classic',
      },
      finances: [
        {
          _id: 'finance-subdoc-1',
          id: 'finance-1',
          sum: 500,
        },
      ],
      tasks: [
        {
          _id: 'task-1',
          title: 'Первая точка',
          taskMedia: [
            {
              _id: 'task-media-1',
              url: '/uploads/media-1.jpg',
            },
          ],
        },
      ],
    },
    gameTeams: [],
  }

  const after = {
    game: {
      name: 'Тайна перевала Дятлова 2',
      updatedAt: '2026-05-24T10:05:00.000Z',
      agentNotifications: {
        _id: 'agent-notifications-2',
        enabled: true,
      },
      storyConfig: {
        _id: 'story-config-2',
        mode: 'classic',
      },
      finances: [
        {
          _id: 'finance-subdoc-2',
          id: 'finance-1',
          sum: 500,
        },
      ],
      tasks: [
        {
          _id: 'task-2',
          title: 'Первая точка',
          taskMedia: [
            {
              _id: 'task-media-2',
              url: '/uploads/media-1.jpg',
            },
          ],
        },
      ],
    },
    gameTeams: [],
  }

  assert.deepEqual(buildGameHistoryDiff({ before, after }), [
    {
      path: 'game.name',
      label: 'Название игры',
      kind: 'changed',
      beforeValue: 'Тайна перевала Дятлова',
      afterValue: 'Тайна перевала Дятлова 2',
    },
  ])
})
