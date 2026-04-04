import dbConnectGlobal from '@utils/dbConnectGlobal'

export const loadCabinetAppAdminTransactions = async ({ limit = 10 }) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return { transactions: [], hasMore: false }
  }

  const Transactions = db.model('Transactions')
  const docs = await Transactions.find({})
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean()

  return {
    transactions: docs.slice(0, limit),
    hasMore: docs.length > limit,
  }
}
