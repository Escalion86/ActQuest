import test from 'node:test'
import assert from 'node:assert/strict'

import buildGameFinancesSummary from '../helpers/gameFinancesSummary.js'

test('builds income expense and balance from mixed finance entries', () => {
  const summary = buildGameFinancesSummary([
    { type: 'income', sum: 1200 },
    { type: 'expense', sum: 300 },
    { type: 'income', sum: 500 },
  ])

  assert.deepEqual(summary, {
    income: 1700,
    expense: 300,
    balance: 1400,
  })
})

test('treats invalid values as zero and defaults to empty summary', () => {
  assert.deepEqual(buildGameFinancesSummary(null), {
    income: 0,
    expense: 0,
    balance: 0,
  })

  assert.deepEqual(
    buildGameFinancesSummary([
      { type: 'expense', sum: '150' },
      { type: 'income', sum: 'oops' },
      {},
    ]),
    {
      income: 0,
      expense: 150,
      balance: -150,
    },
  )
})
