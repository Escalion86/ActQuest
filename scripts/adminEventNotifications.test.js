import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGameOrderSiteEventMessage,
  isScheduledGameForTeamEvent,
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
