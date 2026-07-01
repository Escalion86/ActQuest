import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isPrequelOpenForDate,
  isPrequelReadyForPlayers,
  normalizePrequelConfig,
} from '../helpers/normalizePrequel.js'

test('normalizes empty or invalid prequel open date as null', () => {
  assert.equal(normalizePrequelConfig({ openAt: '' }).openAt, null)
  assert.equal(normalizePrequelConfig({ openAt: 'not-a-date' }).openAt, null)
})

test('keeps valid prequel open date as ISO string', () => {
  assert.equal(
    normalizePrequelConfig({ openAt: '2026-07-01T12:30:00.000Z' }).openAt,
    '2026-07-01T12:30:00.000Z',
  )
})

test('treats prequel without open date as open', () => {
  assert.equal(
    isPrequelOpenForDate(
      { openAt: null },
      new Date('2026-07-01T12:00:00.000Z'),
    ),
    true,
  )
})

test('treats prequel as open when open date has passed', () => {
  assert.equal(
    isPrequelOpenForDate(
      { openAt: '2026-07-01T11:59:59.000Z' },
      new Date('2026-07-01T12:00:00.000Z'),
    ),
    true,
  )
})

test('treats prequel as closed when open date is in the future', () => {
  assert.equal(
    isPrequelOpenForDate(
      { openAt: '2026-07-01T12:00:01.000Z' },
      new Date('2026-07-01T12:00:00.000Z'),
    ),
    false,
  )
})

test('requires open date for prequel player visibility', () => {
  assert.equal(
    isPrequelReadyForPlayers({
      enabled: true,
      openAt: null,
      description: 'Задание',
      bonusCodes: [{ code: 'AQ1' }],
    }),
    false,
  )
})

test('treats prequel with open date description and bonus code as ready for players', () => {
  assert.equal(
    isPrequelReadyForPlayers({
      enabled: true,
      openAt: '2026-07-01T12:00:00.000Z',
      description: 'Задание',
      bonusCodes: [{ code: 'AQ1' }],
    }),
    true,
  )
})

test('does not treat prequel without description or bonus code as ready for players', () => {
  assert.equal(
    isPrequelReadyForPlayers({
      enabled: true,
      openAt: '2026-07-01T12:00:00.000Z',
      description: '',
      bonusCodes: [{ code: 'AQ1' }],
    }),
    false,
  )
  assert.equal(
    isPrequelReadyForPlayers({
      enabled: true,
      openAt: '2026-07-01T12:00:00.000Z',
      description: 'Задание',
      bonusCodes: [],
    }),
    false,
  )
})
