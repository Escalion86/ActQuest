import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyGameDraftPatch,
  areGameDraftsEqual,
} from '../helpers/gameDraftDirtyState.js'
import {
  areComparableMediaListsEqual,
  isInitialEditorHtmlNormalization,
  normalizeComparableEditorPlainText,
} from '../components/modals/game-edit/sharedHelpers.js'

test('keeps game draft clean when patch does not change values', () => {
  const baseline = {
    id: 'game-1',
    status: 'active',
    name: 'Quest',
    hidden: false,
    isRated: true,
  }

  const result = applyGameDraftPatch({
    prevGame: baseline,
    baselineGame: baseline,
    patch: { name: 'Quest' },
  })

  assert.deepEqual(result.nextGame, baseline)
  assert.equal(result.hasUnsavedChanges, false)
})

test('keeps closed game draft clean when patch has no allowed fields', () => {
  const baseline = {
    id: 'game-1',
    status: 'closed',
    name: 'Quest',
    hidden: false,
    isRated: true,
  }

  const result = applyGameDraftPatch({
    prevGame: baseline,
    baselineGame: baseline,
    patch: { name: 'Renamed' },
  })

  assert.equal(result.nextGame, baseline)
  assert.equal(result.hasUnsavedChanges, false)
})

test('marks game draft dirty when patch changes value compared with baseline', () => {
  const baseline = {
    id: 'game-1',
    status: 'active',
    name: 'Quest',
    hidden: false,
    isRated: true,
  }

  const result = applyGameDraftPatch({
    prevGame: baseline,
    baselineGame: baseline,
    patch: { name: 'Quest updated' },
  })

  assert.equal(result.nextGame.name, 'Quest updated')
  assert.equal(result.hasUnsavedChanges, true)
  assert.equal(areGameDraftsEqual(result.nextGame, baseline), false)
})

test('compares rich editor media by type and url only', () => {
  assert.equal(
    areComparableMediaListsEqual(
      [
        {
          type: 'image',
          url: ' https://cdn.example/image.jpg ',
          mime: 'image/jpeg',
          size: 123,
        },
      ],
      [{ type: 'image', url: 'https://cdn.example/image.jpg' }],
    ),
    true,
  )
})

test('compares editor plain text with legacy html line breaks', () => {
  assert.equal(
    normalizeComparableEditorPlainText('Первая строка\n\nВторая строка'),
    normalizeComparableEditorPlainText('Первая строка<br><br>Вторая строка'),
  )
})

test('detects initial editor normalization of legacy html stored in plain field', () => {
  assert.equal(
    isInitialEditorHtmlNormalization({
      nextPlainText: 'Первая строка\n\nВторая строка',
      nextRichText: '<p>Первая строка<br><br>Вторая строка</p>',
      currentPlainText: 'Первая строка<br><br>Вторая строка',
      currentRichText: '',
    }),
    true,
  )
})

test('does not treat text edits as initial editor normalization', () => {
  assert.equal(
    isInitialEditorHtmlNormalization({
      nextPlainText: 'Первая строка\n\nВторая строка изменена',
      nextRichText: '<p>Первая строка<br><br>Вторая строка изменена</p>',
      currentPlainText: 'Первая строка<br><br>Вторая строка',
      currentRichText: '',
    }),
    false,
  )
})
