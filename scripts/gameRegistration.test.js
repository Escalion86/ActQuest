import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canJoinGameAfterStart,
  canRegisterForGame,
  isIndividualGameStart,
} from '../helpers/gameRegistration.js'

test('active game accepts registration while registration is open', () => {
  assert.equal(
    canRegisterForGame({ status: 'active', registrationOpen: true }),
    true,
  )
})

test('started classic game requires both late join and individual start', () => {
  assert.equal(
    canRegisterForGame({
      status: 'started',
      registrationOpen: true,
      allowJoinAfterStart: true,
      individualStart: false,
    }),
    false,
  )
  assert.equal(
    canRegisterForGame({
      status: 'started',
      registrationOpen: true,
      allowJoinAfterStart: true,
      individualStart: true,
    }),
    true,
  )
})

test('story uses storyConfig.startMode as its source of truth', () => {
  const game = {
    type: 'story',
    status: 'started',
    registrationOpen: true,
    allowJoinAfterStart: true,
    individualStart: false,
    storyConfig: { startMode: 'individual' },
  }

  assert.equal(isIndividualGameStart(game), true)
  assert.equal(canJoinGameAfterStart(game), true)
  assert.equal(canRegisterForGame(game), true)
})

test('closed registration overrides late join', () => {
  assert.equal(
    canRegisterForGame({
      status: 'started',
      registrationOpen: false,
      allowJoinAfterStart: true,
      individualStart: true,
    }),
    false,
  )
})
