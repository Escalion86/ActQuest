import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasMeaningfulRichMarkup,
  normalizeComparableRichText,
} from '../components/modals/game-edit/sharedHelpers.js'

test('изменение только цвета текста подсказки сохраняется', () => {
  const plainText = 'Подсказка'
  const oldHtml = '<p><span style="color:rgb(1, 28, 41)">Подсказка</span></p>'
  const newHtml = '<p><span style="color:rgb(255, 255, 255)">Подсказка</span></p>'

  assert.notEqual(
    normalizeComparableRichText(oldHtml, plainText),
    normalizeComparableRichText(newHtml, plainText),
  )
  assert.equal(normalizeComparableRichText(newHtml, plainText), newHtml)
  assert.notEqual(
    normalizeComparableRichText(newHtml, plainText),
    normalizeComparableRichText('<p>Подсказка</p>', plainText),
  )
})

test('стили абзаца и шрифта не теряются при сравнении', () => {
  assert.equal(hasMeaningfulRichMarkup('<p style="text-align:center">Текст</p>'), true)
  assert.equal(hasMeaningfulRichMarkup('<p><span style="font-family:Inter">Текст</span></p>'), true)
})

test('пустые структурные обёртки не считаются форматированием', () => {
  assert.equal(normalizeComparableRichText('<p><span>Подсказка</span></p>', 'Подсказка'), '')
})
