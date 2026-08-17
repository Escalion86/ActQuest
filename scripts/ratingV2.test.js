import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRatingMetricsV2,
  buildRatingRanksV2,
  calculateRatingGameScore,
} from '../helpers/ratingV2.js'

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
