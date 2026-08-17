import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGameOrderSiteEventMessage,
  buildGameReviewSiteEventMessage,
  isScheduledGameForTeamEvent,
  shouldNotifyAdminsAboutGameReview,
} from '../helpers/adminEventNotifications.js'

test('treats active not started game as scheduled for team admin events', () => {
  assert.equal(
    isScheduledGameForTeamEvent({
      status: 'active',
      dateStart: new Date('2026-07-01T12:00:00.000Z'),
      dateStartFact: null,
      dateEndFact: null,
    }),
    true,
  )
})

test('does not treat started finished closed or canceled game as scheduled for team admin events', () => {
  assert.equal(
    isScheduledGameForTeamEvent({
      status: 'active',
      dateStartFact: new Date('2026-07-01T12:00:00.000Z'),
    }),
    false,
  )
  assert.equal(
    isScheduledGameForTeamEvent({
      status: 'started',
      dateStartFact: new Date('2026-07-01T12:00:00.000Z'),
    }),
    false,
  )
  assert.equal(isScheduledGameForTeamEvent({ status: 'finished' }), false)
  assert.equal(isScheduledGameForTeamEvent({ status: 'closed' }), false)
  assert.equal(isScheduledGameForTeamEvent({ status: 'canceled' }), false)
})

test('builds readable game order event message', () => {
  assert.equal(
    buildGameOrderSiteEventMessage({
      contactName: 'Иван',
      companyName: 'Рога и Копыта',
      location: 'krsk',
      participantsCount: 12,
    }),
    'Новая заявка на проведение игры: Иван, Рога и Копыта, 12 участников.',
  )
})

test('builds city admin push message for a new game review', () => {
  assert.equal(
    buildGameReviewSiteEventMessage({
      gameName: 'Ночная смена',
      overallRating: 9,
      difficultyRating: 7,
    }),
    'Поступил новый отзыв об игре «Ночная смена»: 9.0 ★ · 7.0 ◈.',
  )
})

test('marks a repeated game review submission in the admin push message', () => {
  assert.equal(
    buildGameReviewSiteEventMessage({
      gameName: 'Ночная смена',
      overallRating: 8,
      difficultyRating: 6,
      isResubmission: true,
    }),
    'Повторно отправлен отзыв об игре «Ночная смена»: 8.0 ★ · 6.0 ◈.',
  )
})

test('notifies admins only for a new review or a new moderation cycle', () => {
  assert.equal(shouldNotifyAdminsAboutGameReview(null), true)
  assert.equal(
    shouldNotifyAdminsAboutGameReview({ moderationStatus: 'pending' }),
    false,
  )
  assert.equal(
    shouldNotifyAdminsAboutGameReview({ moderationStatus: 'approved' }),
    true,
  )
  assert.equal(
    shouldNotifyAdminsAboutGameReview({ moderationStatus: 'rejected' }),
    true,
  )
})
