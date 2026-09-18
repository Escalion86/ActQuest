import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyGameDraftPatch,
  areGameDraftsEqual,
} from '../helpers/gameDraftDirtyState.js'
import {
  areComparableMediaListsEqual,
  isInitialEditorHtmlNormalization,
  normalizeComparableEditorPlainText,
} from '../components/modals/game-edit/sharedHelpers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const taskRichEditorSource = fs.readFileSync(
  path.join(currentDir, '../components/cabinet/TaskRichEditor.js'),
  'utf8',
)

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

test('allows changing tasks audience for closed game draft', () => {
  const baseline = {
    id: 'game-1',
    status: 'closed',
    showTasks: true,
    showTasksAudience: 'all',
    hidden: false,
    isRated: true,
  }

  const result = applyGameDraftPatch({
    prevGame: baseline,
    baselineGame: baseline,
    patch: { showTasksAudience: 'participants' },
  })

  assert.equal(result.nextGame.showTasksAudience, 'participants')
  assert.equal(result.hasUnsavedChanges, true)
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

test('suppresses update events only for programmatic rich editor synchronization', () => {
  assert.match(
    taskRichEditorSource,
    /setContent\(normalizedContentValue,\s*\{\s*emitUpdate:\s*false,?\s*\}\)/,
  )
})

test('propagates rich editor updates without relying on focus state', () => {
  assert.doesNotMatch(
    taskRichEditorSource,
    /if\s*\(!nextEditor\.isFocused\)\s*return/,
  )
})
