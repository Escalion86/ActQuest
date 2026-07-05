const test = require('node:test')
const assert = require('node:assert/strict')

const normalizeIdForStorage = require('../helpers/normalizeIdForStorage')
const { normalizeIdsForStorage } = normalizeIdForStorage

test('normalizes ObjectId-like strings to lowercase for string storage fields', () => {
  assert.equal(
    normalizeIdForStorage('6A44D71CD81C48E351D5B3F1'),
    '6a44d71cd81c48e351d5b3f1',
  )
})

test('keeps non-ObjectId identifiers unchanged except trimming', () => {
  assert.equal(normalizeIdForStorage(' Team-ABC '), 'Team-ABC')
})

test('keeps nullish scalar ids as null', () => {
  assert.equal(normalizeIdForStorage(null), null)
  assert.equal(normalizeIdForStorage(undefined), null)
})

test('normalizes ObjectId-like values inside arrays', () => {
  assert.deepEqual(
    normalizeIdsForStorage([
      '6A44D71CD81C48E351D5B3F1',
      'custom-ABC',
      null,
      '',
      ' 6A2653771ECFA7CED96823EE ',
    ]),
    ['6a44d71cd81c48e351d5b3f1', 'custom-ABC', '6a2653771ecfa7ced96823ee'],
  )
})
