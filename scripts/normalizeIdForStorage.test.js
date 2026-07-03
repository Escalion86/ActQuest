const test = require('node:test')
const assert = require('node:assert/strict')

const normalizeIdForStorage = require('../helpers/normalizeIdForStorage')

test('normalizes ObjectId-like strings to lowercase for string storage fields', () => {
  assert.equal(
    normalizeIdForStorage('6A44D71CD81C48E351D5B3F1'),
    '6a44d71cd81c48e351d5b3f1',
  )
})

test('keeps non-ObjectId identifiers unchanged except trimming', () => {
  assert.equal(normalizeIdForStorage(' Team-ABC '), 'Team-ABC')
})
