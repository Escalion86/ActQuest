import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeAmountStepperDisplayValue,
  normalizeAmountStepperValue,
} from '../helpers/amountStepperInput.js'

test('normalizeAmountStepperValue removes leading zeroes from positive numbers', () => {
  assert.equal(normalizeAmountStepperValue('01234', 0), 1234)
  assert.equal(normalizeAmountStepperValue('0005', 0), 5)
})

test('normalizeAmountStepperValue keeps zero when the input contains only zeroes', () => {
  assert.equal(normalizeAmountStepperValue('0', 0), 0)
  assert.equal(normalizeAmountStepperValue('000', 0), 0)
})

test('normalizeAmountStepperDisplayValue returns a display value without leading zeroes', () => {
  assert.equal(normalizeAmountStepperDisplayValue('01234', 0), '1234')
  assert.equal(normalizeAmountStepperDisplayValue('0005', 0), '5')
  assert.equal(normalizeAmountStepperDisplayValue('000', 0), '0')
})
