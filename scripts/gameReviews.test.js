import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findGameReviewMembership,
  normalizeGameReviewInput,
  resolveSessionGameReviewIdentity,
  serializeGameReview,
  serializePublishedGameReview,
} from '../server/gameReviews.js'
import normalizeGameForCabinet from '../helpers/normalizeGameForCabinet.js'

test('accepts only integer game review ratings from 1 to 10', () => {
  for (const rating of [1, 5, 10]) {
    const result = normalizeGameReviewInput({
      overallRating: rating,
      difficultyRating: 5,
    })
    assert.equal(result.success, true)
    assert.equal(result.data.overallRating, rating)
  }

  for (const rating of [0, 11, 1.5, 'wrong', null]) {
    assert.equal(
      normalizeGameReviewInput({ overallRating: rating, difficultyRating: 5 })
        .success,
      false,
    )
  }
})

test('accepts only integer difficulty ratings from 1 to 10', () => {
  for (const difficultyRating of [1, 5, 10]) {
    const result = normalizeGameReviewInput({
      overallRating: 8,
      difficultyRating,
    })
    assert.equal(result.success, true)
    assert.equal(result.data.difficultyRating, difficultyRating)
  }

  for (const difficultyRating of [0, 11, 1.5, 'wrong', null]) {
    assert.equal(
      normalizeGameReviewInput({ overallRating: 8, difficultyRating }).success,
      false,
    )
  }
})

test('normalizes review tags and text without accepting unknown tags', () => {
  const result = normalizeGameReviewInput({
    overallRating: 8,
    difficultyRating: 6,
    tags: [
      'atmosphere',
      'route_and_locations',
      'actors',
      'technical_issues',
      'unknown',
      'atmosphere',
    ],
    likedText: '  Отличная атмосфера  ',
    improvementText: '  Добавить света  ',
    publicationConsent: true,
  })

  assert.equal(result.success, true)
  assert.deepEqual(result.data.tags, [
    'atmosphere',
    'route_and_locations',
    'actors',
  ])
  assert.equal(result.data.likedText, 'Отличная атмосфера')
  assert.equal(result.data.improvementText, 'Добавить света')
  assert.equal(result.data.publicationConsent, true)
})

test('resolves participation from the frozen result snapshot', () => {
  const game = {
    result: {
      teamsUsers: [
        { teamId: 'team-1', userId: 'user-1', userTelegramId: 123 },
      ],
    },
  }

  assert.equal(
    findGameReviewMembership({ game, userId: 'user-1', telegramId: null })
      ?.teamId,
    'team-1',
  )
  assert.equal(
    findGameReviewMembership({ game, userId: 'legacy-user', telegramId: 123 })
      ?.teamId,
    'team-1',
  )
  assert.equal(
    findGameReviewMembership({ game, userId: 'stranger', telegramId: 456 }),
    null,
  )
})

test('prefers the canonical session user id', () => {
  assert.deepEqual(
    resolveSessionGameReviewIdentity({
      globalUserId: 'global-user',
      id: 'fallback-user',
      telegramId: 123,
    }),
    { userId: 'global-user', telegramId: 123 },
  )
})

test('keeps aggregate and personal review ratings in cabinet game data', () => {
  const game = normalizeGameForCabinet({
    _id: 'game-1',
    reviewAverageRating: 8.666,
    reviewAverageDifficultyRating: 6.333,
    reviewsCount: 3,
    userReviewRating: 9,
    userReviewDifficultyRating: 7,
  })

  assert.equal(game.reviewAverageRating, 8.666)
  assert.equal(game.reviewAverageDifficultyRating, 6.333)
  assert.equal(game.reviewsCount, 3)
  assert.equal(game.userReviewRating, 9)
  assert.equal(game.userReviewDifficultyRating, 7)
})

test('published review serialization does not expose participant identities', () => {
  const review = serializePublishedGameReview({
    _id: 'review-1',
    gameId: 'game-1',
    userId: 'user-1',
    teamId: 'team-1',
    overallRating: 9,
    difficultyRating: 7,
    tags: ['actors'],
    likedText: 'Понравились актёры',
    improvementText: '',
    isRatingIncluded: false,
    moderationReason: 'Служебная причина',
    createdAt: new Date('2026-08-17T12:00:00.000Z'),
  })

  assert.equal(review.overallRating, 9)
  assert.equal(review.difficultyRating, 7)
  assert.equal(review.isRatingIncluded, false)
  assert.equal(review.userId, undefined)
  assert.equal(review.teamId, undefined)
  assert.equal(review.gameId, undefined)
  assert.equal(review.moderationReason, undefined)
})

test('legacy reviews remain included in rating by default', () => {
  const review = serializeGameReview({
    _id: 'review-legacy',
    gameId: 'game-1',
    userId: 'user-1',
    teamId: 'team-1',
    overallRating: 8,
    difficultyRating: 6,
  })

  assert.equal(review.isRatingIncluded, true)
  assert.equal(review.ratingExclusionReason, '')
  assert.equal(review.ratingExcludedAt, null)
  assert.equal(review.moderationReason, '')
})
