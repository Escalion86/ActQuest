import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeGameOrderForCabinet from '@helpers/normalizeGameOrderForCabinet'

export const loadCabinetAppAdminGameOrders = async ({
  offset = 0,
  limit = 20,
  status = 'all',
  location = 'all',
} = {}) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return { orders: [], hasMore: false }
  }

  const query = {}
  const normalizedStatus =
    typeof status === 'string' ? status.trim().toLowerCase() : 'all'
  const normalizedLocation =
    typeof location === 'string' ? location.trim().toLowerCase() : 'all'

  if (normalizedStatus && normalizedStatus !== 'all') {
    query.status = normalizedStatus
  }
  if (normalizedLocation && normalizedLocation !== 'all') {
    query.location = normalizedLocation
  }

  const GameOrders = db.model('GameOrders')
  const numericLimit = Number(limit) || 20
  const docs = await GameOrders.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .skip(Number(offset) || 0)
    .limit(numericLimit + 1)
    .lean()

  const hasMore = docs.length > numericLimit
  const items = (hasMore ? docs.slice(0, numericLimit) : docs).map(
    normalizeGameOrderForCabinet,
  )

  return {
    orders: items,
    hasMore,
  }
}
