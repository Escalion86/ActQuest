import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isCompletedParticipationStatus,
  resolveParticipationMetricsTransition,
  resolveParticipationPlace,
  resolveUserParticipationTeams,
} from '../helpers/gameParticipation.js'
import {
  buildCompletedParticipationStats,
  buildParticipationSnapshot,
} from '../server/buildCompletedParticipationStats.js'

const completedGame = {
  _id: 'game-1',
  status: 'finished',
  isRated: false,
  result: {
    teams: [
      { _id: 'historic-team', name: 'Историческая команда' },
      { _id: 'current-team', name: 'Текущая команда' },
    ],
    teamsUsers: [
      { userId: 'target-user', teamId: 'historic-team' },
      { userId: 'other-user', teamId: 'current-team' },
    ],
    teamsPlaces: {
      'historic-team': 9,
      'current-team': 2,
    },
  },
}

test('finished и closed считаются сыгранными, а started — нет', () => {
  assert.equal(isCompletedParticipationStatus('finished'), true)
  assert.equal(isCompletedParticipationStatus('closed'), true)
  assert.equal(isCompletedParticipationStatus('started'), false)
})

test('переходы статуса обновляют обычную статистику и рейтинг раздельно', () => {
  assert.deepEqual(
    resolveParticipationMetricsTransition({
      previousStatus: 'started',
      nextStatus: 'finished',
    }),
    { shouldUpdateParticipationStats: true, shouldUpdateRatings: false },
  )
  assert.deepEqual(
    resolveParticipationMetricsTransition({
      previousStatus: 'finished',
      nextStatus: 'closed',
    }),
    { shouldUpdateParticipationStats: false, shouldUpdateRatings: true },
  )
  assert.deepEqual(
    resolveParticipationMetricsTransition({
      previousStatus: 'closed',
      nextStatus: 'active',
    }),
    { shouldUpdateParticipationStats: true, shouldUpdateRatings: true },
  )
})

test('для завершённой игры snapshot важнее текущего членства', () => {
  const participation = resolveUserParticipationTeams({
    game: completedGame,
    userId: 'target-user',
    currentParticipation: [
      { teamId: 'current-team', teamName: 'Текущая команда' },
    ],
  })

  assert.deepEqual(participation, [
    {
      teamId: 'historic-team',
      teamName: 'Историческая команда',
      isCaptain: false,
    },
  ])
  assert.equal(
    resolveParticipationPlace({
      game: completedGame,
      teamIds: participation.map((team) => team.teamId),
    }),
    9,
  )
})

test('для старого snapshot без места используется безопасный fallback', () => {
  const game = {
    status: 'closed',
    result: {
      teams: [{ _id: 'team-1' }, { _id: 'team-2' }, { _id: 'team-3' }],
      teamsUsers: [{ userId: 'target-user', teamId: 'team-2' }],
      teamsPlaces: {},
    },
  }

  assert.equal(
    resolveParticipationPlace({ game, teamIds: ['team-2'] }),
    3,
  )
})

test('глобальный backfill считает finished, closed и нерейтинговые игры', () => {
  const closedWithoutPlace = {
    _id: 'game-2',
    status: 'closed',
    isRated: false,
    dateStart: '2026-05-23T14:00:00.000Z',
    result: {
      teams: [{ _id: 'team-1' }, { _id: 'team-2' }, { _id: 'team-3' }],
      teamsUsers: [{ userId: 'target-user', teamId: 'team-2' }],
      teamsPlaces: {},
    },
  }
  const started = {
    ...closedWithoutPlace,
    _id: 'game-3',
    status: 'started',
  }
  const { userGamesByKey, teamGamesById, diagnostics } =
    buildCompletedParticipationStats([
      {
        ...completedGame,
        dateStart: '2026-04-18T13:00:00.000Z',
      },
      closedWithoutPlace,
      started,
    ])

  assert.equal(diagnostics.gamesScanned, 2)
  assert.equal(diagnostics.gamesSkippedByStatus, 1)
  assert.deepEqual(
    buildParticipationSnapshot({
      gamesById: userGamesByKey.get('uid:target-user'),
      nowIso: '2026-07-27T00:00:00.000Z',
    }),
    {
      version: 1,
      updatedAt: '2026-07-27T00:00:00.000Z',
      playedGamesCount: 2,
      winsCount: 0,
      podiumCount: 1,
      lastPlayedAt: '2026-05-23T14:00:00.000Z',
    },
  )
  assert.equal(teamGamesById.get('historic-team').size, 1)
  assert.equal(teamGamesById.get('team-2').size, 1)
})
