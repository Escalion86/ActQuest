import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRatingMetricsV2,
  buildRatingRanksV2,
  calculateRatingGameScore,
} from '../helpers/ratingV2.js'
import { loadRatedGameEntries } from '../server/loadRatedGameEntries.js'
import updateParticipantsRatings from '../server/updateParticipantsRatings.js'

test('нормализует место относительно числа соперников', () => {
  assert.equal(calculateRatingGameScore({ place: 1, participantsCount: 10 }), 100)
  assert.equal(calculateRatingGameScore({ place: 10, participantsCount: 10 }), 0)
  assert.equal(calculateRatingGameScore({ place: 3, participantsCount: 3 }), 0)
  assert.equal(
    calculateRatingGameScore({ place: 4, participantsCount: 30 }),
    (100 * 26) / 29,
  )
})

test('не учитывает игру без соперников и некорректное место', () => {
  assert.equal(calculateRatingGameScore({ place: 1, participantsCount: 1 }), null)
  assert.equal(calculateRatingGameScore({ place: 4, participantsCount: 3 }), null)
})

test('допускает в рейтинг после трёх соревновательных игр', () => {
  const results = [
    { gameId: '1', place: 1, participantsCount: 5, startedAt: 1 },
    { gameId: '2', place: 2, participantsCount: 5, startedAt: 2 },
    { gameId: '3', place: 3, participantsCount: 5, startedAt: 3 },
  ]
  const metrics = buildRatingMetricsV2({ results, totalGames: 5 })

  assert.equal(metrics.isEligible, true)
  assert.equal(metrics.playedGames, 3)
  assert.equal(metrics.missedGames, 2)
  assert.equal(metrics.attendance, 0.6)
  assert.equal(metrics.wins, 1)
  assert.equal(metrics.finalScore, 75)
})

test('сортирует по очкам, затем играм, победам и последнему результату', () => {
  const result = (scores) =>
    scores.map((place, index) => ({
      gameId: String(index),
      place,
      participantsCount: 5,
      startedAt: index,
    }))
  const ranks = buildRatingRanksV2(
    new Map([
      ['stable', result([2, 2, 2, 2])],
      ['short', result([2, 2, 2])],
      ['lower', result([3, 3, 3])],
      ['same-a', result([1, 2, 3])],
      ['same-b', result([1, 2, 3])],
    ]),
    4,
  )

  assert.equal(ranks.get('stable').rank, 1)
  assert.equal(ranks.get('short').rank, 4)
  assert.equal(ranks.get('lower').rank, 5)
  assert.equal(ranks.get('same-a').rank, ranks.get('same-b').rank)
})

test('в сезонном рейтинге считает пропущенные игры как ноль очков', () => {
  const contactZoo = [
    { gameId: '1', place: 2, participantsCount: 12, startedAt: 1 },
    { gameId: '2', place: 1, participantsCount: 11, startedAt: 2 },
    { gameId: '3', place: 2, participantsCount: 14, startedAt: 3 },
  ]
  const starTrek = [
    { gameId: '1', place: 1, participantsCount: 12, startedAt: 1 },
    { gameId: '2', place: 3, participantsCount: 11, startedAt: 2 },
    { gameId: '3', place: 1, participantsCount: 14, startedAt: 3 },
    { gameId: '4', place: 2, participantsCount: 9, startedAt: 4 },
  ]
  const results = new Map([
    ['contact-zoo', contactZoo],
    ['star-trek', starTrek],
  ])
  const allTimeRanks = buildRatingRanksV2(results, 4)
  const ranks = buildRatingRanksV2(
    results,
    4,
    { scoreMissedGamesAsZero: true },
  )

  assert.equal(allTimeRanks.get('contact-zoo').rank, 1)
  assert.equal(allTimeRanks.get('star-trek').rank, 2)
  assert.equal(ranks.get('star-trek').rank, 1)
  assert.equal(ranks.get('contact-zoo').rank, 2)
  assert.equal(ranks.get('star-trek').finalScore, 91.875)
  assert.ok(
    Math.abs(ranks.get('contact-zoo').finalScore - 70.8041958041958) <
      1e-9,
  )
  assert.ok(
    Math.abs(ranks.get('contact-zoo').averageScore - 94.4055944055944) <
      1e-9,
  )
})

test('берёт общий результат этапа и оставляет запасное проведение лишь до публикации', async () => {
  const session = {}
  const seasonId = 'autumn'
  const location = 'ekaterinburg'
  const calls = []
  const fallbackGameIds = ['first-day']
  const stage = {
    _id: 'stage',
    dateStart: '2026-10-20',
    seasonId,
    location,
    fallbackGameIds,
    result: null,
  }
  const independentlyRatedGame = {
    _id: 'standalone',
    dateStart: '2026-10-01',
    seasonId,
    location,
    result: {
      teamsPlaces: { teamE: 1, teamF: 2 },
      teamsUsers: [{ teamId: 'teamE', userId: 'playerE' }],
    },
  }
  const firstDay = { _id: fallbackGameIds[0], dateStart: stage.dateStart }
  const writes = new Map()
  const db = {
    model: (name) => ({
      bulkWrite: async (operations, options) => {
        assert.equal(options.session, session)
        writes.set(name, operations.map(({ updateOne }) => [updateOne.filter._id, updateOne.update]))
      },
      find: (filter) => {
        calls.push({ name, filter })
        const query = {
          select: () => query,
          session: (value) => {
            assert.equal(value, session)
            return query
          },
          lean: async () => {
            if (name === 'GameStages') return [stage]
            const expected = [{ stageId: null }]
            const hasFallback = !stage.result && stage.fallbackGameIds.length > 0
            if (hasFallback) {
              expected.push({ stageId: stage._id, _id: { $in: stage.fallbackGameIds } })
            }
            assert.deepEqual(filter.$or, expected)
            return hasFallback
              ? [independentlyRatedGame, firstDay]
              : [independentlyRatedGame]
          },
        }
        return query
      },
    }),
  }
  const options = { db, location, seasonId, session }

  const pending = await loadRatedGameEntries(options)
  assert.deepEqual(pending.map((entry) => entry._id), ['standalone', 'first-day'])

  stage.result = {
    teamsPlaces: { teamA: 3, teamB: 1, teamC: 2, teamD: 4 },
    teamsUsers: [{ teamId: 'teamA', userId: 'playerA' }],
  }
  const published = await loadRatedGameEntries(options)
  assert.deepEqual(published.map((entry) => entry._id), ['standalone', 'stage'])
  assert.equal(published[1].stageId, 'stage')
  assert.deepEqual(published[1].result, stage.result)
  for (const { name, filter } of calls) {
    assert.equal(filter.location, location)
    assert.equal(filter.seasonId, seasonId)
    assert.deepEqual(filter.isRated, { $ne: false })
    if (name === 'Games') assert.equal(filter.status, 'closed')
  }

  await updateParticipantsRatings({ db, session, game: stage, updateAllEntities: true })
  const teamSnapshots = new Map(writes.get('Teams'))
  const playerSnapshots = new Map(writes.get('Users'))
  const teamA = teamSnapshots.get('teamA').$set.ratingsBySeason[seasonId]
  const playerA = playerSnapshots.get('playerA').$set.ratingsBySeason[seasonId]
  assert.equal(teamA.playedGames, 1)
  assert.equal(teamA.totalGames, 2)
  assert.equal(teamA.missedGames, 1)
  assert.equal(teamA.finalScore, 100 / 3 / 2)
  assert.equal(playerA.finalScore, teamA.finalScore)
  assert.equal(teamSnapshots.get('teamB').$set.ratingsBySeason[seasonId].finalScore, 50)

  stage.result = null
  stage.fallbackGameIds = []
  await updateParticipantsRatings({
    db,
    session,
    game: stage,
    updateAllEntities: true,
    affectedGames: [published[1]],
  })
  const withdrawal = new Map(writes.get('Teams'))
  assert.deepEqual(withdrawal.get('teamA').$unset, {
    rating: '', ratingsByLocation: '', ratingsBySeason: '',
  })
  assert.equal(withdrawal.get('teamE').$set.ratingsBySeason[seasonId].finalScore, 100)
})
