const EMPTY_SUMMARY = {
  income: 0,
  expense: 0,
  balance: 0,
}

const buildGameFinancesSummary = (finances) => {
  if (!Array.isArray(finances) || finances.length === 0) {
    return EMPTY_SUMMARY
  }

  const summary = finances.reduce(
    (acc, entry) => {
      const amount = Number(entry?.sum) || 0
      if (entry?.type === 'expense') {
        acc.expense += amount
      } else {
        acc.income += amount
      }
      return acc
    },
    { income: 0, expense: 0 },
  )

  return {
    income: summary.income,
    expense: summary.expense,
    balance: summary.income - summary.expense,
  }
}

export default buildGameFinancesSummary
