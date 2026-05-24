import test from 'node:test'
import assert from 'node:assert/strict'

import rollbackGameToHistoryEntry from '../server/gameHistory/rollbackGameToHistoryEntry.js'

test('restores game and exact set of game teams from selected snapshot', async () => {
  const operations = {
    gameReplace: null,
    gameTeamDeletes: [],
    gameTeamUpserts: [],
  }

  const currentGame = {
    _id: 'game-1',
    name: 'Current name',
    status: 'started',
    result: { computed: { summary: { teamsCount: 2 } } },
  }

  const currentGameTeams = [
    { _id: 'gt-1', gameId: 'game-1', teamId: 'team-1', outOfCompetition: false },
    { _id: 'gt-extra', gameId: 'game-1', teamId: 'team-extra', outOfCompetition: true },
  ]

  const db = {
    model(modelName) {
      if (modelName === 'Games') {
        return {
          async findById(gameId) {
            return gameId === 'game-1' ? currentGame : null
          },
          async replaceOne(filter, replacement) {
            operations.gameReplace = { filter, replacement }
            return { acknowledged: true }
          },
        }
      }

      if (modelName === 'GamesTeams') {
        return {
          find(query) {
            assert.deepEqual(query, { gameId: 'game-1' })
            return {
              lean: async () => currentGameTeams,
            }
          },
          async deleteMany(query) {
            operations.gameTeamDeletes.push(query)
            return { acknowledged: true }
          },
          async updateOne(filter, update, options) {
            operations.gameTeamUpserts.push({ filter, update, options })
            return { acknowledged: true }
          },
        }
      }

      throw new Error(`Unexpected model: ${modelName}`)
    },
  }

  const result = await rollbackGameToHistoryEntry({
    db,
    gameId: 'game-1',
    historyEntry: {
      _id: 'history-10',
      snapshot: {
        schemaVersion: 1,
        capturedAt: '2026-05-24T10:00:00.000Z',
        game: {
          _id: 'game-1',
          name: 'Snapshot name',
          status: 'finished',
          result: { computed: { summary: { teamsCount: 1 } } },
        },
        gameTeams: [
          { _id: 'gt-1', gameId: 'game-1', teamId: 'team-1', outOfCompetition: false },
          { _id: 'gt-2', gameId: 'game-1', teamId: 'team-2', outOfCompetition: false },
        ],
      },
    },
  })

  assert.deepEqual(operations.gameReplace, {
    filter: { _id: 'game-1' },
    replacement: {
      _id: 'game-1',
      name: 'Snapshot name',
      status: 'finished',
      result: { computed: { summary: { teamsCount: 1 } } },
    },
  })

  assert.deepEqual(operations.gameTeamDeletes, [
    {
      gameId: 'game-1',
      _id: { $in: ['gt-extra'] },
    },
  ])

  assert.deepEqual(operations.gameTeamUpserts, [
    {
      filter: { _id: 'gt-1', gameId: 'game-1' },
      update: {
        $set: { _id: 'gt-1', gameId: 'game-1', teamId: 'team-1', outOfCompetition: false },
      },
      options: { upsert: true },
    },
    {
      filter: { _id: 'gt-2', gameId: 'game-1' },
      update: {
        $set: { _id: 'gt-2', gameId: 'game-1', teamId: 'team-2', outOfCompetition: false },
      },
      options: { upsert: true },
    },
  ])

  assert.deepEqual(result, {
    restoredEntryId: 'history-10',
    rolledBackEntriesCount: null,
    currentState: {
      game: currentGame,
      gameTeams: currentGameTeams,
    },
    restoredState: {
      game: {
        _id: 'game-1',
        name: 'Snapshot name',
        status: 'finished',
        result: { computed: { summary: { teamsCount: 1 } } },
      },
      gameTeams: [
        { _id: 'gt-1', gameId: 'game-1', teamId: 'team-1', outOfCompetition: false },
        { _id: 'gt-2', gameId: 'game-1', teamId: 'team-2', outOfCompetition: false },
      ],
    },
    warnings: [
      'Откат может повлиять на рейтинги и закрытую статистику. Они не пересчитываются автоматически.',
    ],
  })
})
