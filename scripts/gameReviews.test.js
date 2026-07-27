import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findGameReviewMembership,
  normalizeGameReviewInput,
  resolveSessionGameReviewIdentity,
} from '../server/gameReviews.js'

test('accepts only integer game review ratings from 1 to 10', () => {
  for (const rating of [1, 5, 10]) {
    const result = normalizeGameReviewInput({ overallRating: rating })
    assert.equal(result.success, true)
    assert.equal(result.data.overallRating, rating)
  }

  for (const rating of [0, 11, 1.5, 'wrong', null]) {
    assert.equal(normalizeGameReviewInput({ overallRating: rating }).success, false)
  }
})

test('normalizes review tags and text without accepting unknown tags', () => {
  const result = normalizeGameReviewInput({
    overallRating: 8,
    tags: ['atmosphere', 'unknown', 'atmosphere'],
    likedText: '  Отличная атмосфера  ',
    improvementText: '  Добавить света  ',
    publicationConsent: true,
  })

  assert.equal(result.success, true)
  assert.deepEqual(result.data.tags, ['atmosphere'])
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
