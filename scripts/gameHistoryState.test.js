import test from 'node:test'
import assert from 'node:assert/strict'
import { ObjectId } from 'mongodb'

import normalizeGameHistoryState from '../server/gameHistory/normalizeGameHistoryState.js'
import sanitizeGameHistoryDisplayState from '../server/gameHistory/sanitizeGameHistoryDisplayState.js'

test('normalizes game history state into plain rollback-safe json', () => {
  const state = normalizeGameHistoryState({
    game: {
      _id: { toString: () => 'game-1' },
      name: 'Night Ride',
      dateStart: new Date('2026-05-20T12:00:00.000Z'),
      result: {
        teamsPlaces: new Map([
          [{ toString: () => 'team-2' }, 2],
          ['team-1', 1],
        ]),
      },
      nested: {
        objectId: { toString: () => 'obj-1' },
      },
      __v: 5,
    },
    gameTeams: [
      {
        _id: { toString: () => 'gt-2' },
        teamId: { toString: () => 'team-2' },
        gameId: { toString: () => 'game-1' },
        createdAt: new Date('2026-05-21T10:00:00.000Z'),
      },
      {
        _id: { toString: () => 'gt-1' },
        teamId: { toString: () => 'team-1' },
        gameId: { toString: () => 'game-1' },
        updatedAt: new Date('2026-05-22T10:00:00.000Z'),
      },
    ],
  })

  assert.deepEqual(state, {
    game: {
      _id: 'game-1',
      name: 'Night Ride',
      dateStart: '2026-05-20T12:00:00.000Z',
      result: {
        teamsPlaces: {
          'team-1': 1,
          'team-2': 2,
        },
      },
      nested: {
        objectId: 'obj-1',
      },
    },
    gameTeams: [
      {
        _id: 'gt-1',
        teamId: 'team-1',
        gameId: 'game-1',
        updatedAt: '2026-05-22T10:00:00.000Z',
      },
      {
        _id: 'gt-2',
        teamId: 'team-2',
        gameId: 'game-1',
        createdAt: '2026-05-21T10:00:00.000Z',
      },
    ],
  })
})

test('returns stable empty state when game or game teams are missing', () => {
  assert.deepEqual(normalizeGameHistoryState({ game: null, gameTeams: null }), {
    game: null,
    gameTeams: [],
  })
})

test('stringifies bson object ids instead of exposing internal buffer fields', () => {
  const objectId = new ObjectId('6831b2f10f6c8f4fd49e1234')

  const state = normalizeGameHistoryState({
    game: {
      agentNotifications: {
        _id: objectId,
        onCurrentTask: true,
      },
    },
  })

  assert.deepEqual(state, {
    game: {
      agentNotifications: {
        _id: '6831b2f10f6c8f4fd49e1234',
        onCurrentTask: true,
      },
    },
    gameTeams: [],
  })
})

test('removes technical subdocument ids and timestamps from display state', () => {
  const state = sanitizeGameHistoryDisplayState({
    game: {
      _id: 'game-1',
      name: 'Night Ride',
      updatedAt: '2026-05-24T10:00:00.000Z',
      storyConfig: {
        _id: 'story-config-1',
        showInventory: true,
      },
      finances: [
        {
          _id: 'finance-1-subdoc',
          id: 'finance-1',
          sum: 1000,
          createdAt: '2026-05-24T09:00:00.000Z',
        },
      ],
    },
    gameTeams: [
      {
        _id: 'gt-1',
        teamId: 'team-1',
        createdAt: '2026-05-24T09:30:00.000Z',
      },
    ],
  })

  assert.deepEqual(state, {
    game: {
      name: 'Night Ride',
      storyConfig: {
        showInventory: true,
      },
      finances: [
        {
          id: 'finance-1',
          sum: 1000,
        },
      ],
    },
    gameTeams: [
      {
        teamId: 'team-1',
      },
    ],
  })
})
