import test from 'node:test'
import assert from 'node:assert/strict'

import getGameProcessFinishingPlace from '../helpers/getGameProcessFinishingPlace.js'

test('game process keeps finishing place even when public visibility is disabled', () => {
  assert.equal(
    getGameProcessFinishingPlace({
      finishingPlace: '  Финишный штаб  ',
      showFinishingPlace: false,
      individualStart: false,
    }),
    'Финишный штаб',
  )
})

test('game process returns empty string when finishing place is not filled', () => {
  assert.equal(
    getGameProcessFinishingPlace({
      finishingPlace: '   ',
      showFinishingPlace: false,
      individualStart: false,
    }),
    '',
  )
})
