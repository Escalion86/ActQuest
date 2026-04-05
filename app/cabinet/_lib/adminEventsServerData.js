import dbConnectGlobal from '@utils/dbConnectGlobal'

export const loadCabinetAppAdminEvents = async ({
  offset = 0,
  limit = 20,
  locationFilter = 'all',
} = {}) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return { events: [], hasMore: false }
  }

  const SiteEvents = db.model('SiteEvents')
  const query =
    typeof locationFilter === 'string' &&
    locationFilter.trim().toLowerCase() !== 'all'
      ? { location: locationFilter.trim().toLowerCase() }
      : {}
  const docs = await SiteEvents.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .skip(Number(offset) || 0)
    .limit((Number(limit) || 20) + 1)
    .lean()

  const hasMore = docs.length > (Number(limit) || 20)
  const items = (hasMore ? docs.slice(0, Number(limit) || 20) : docs).map(
    (doc) => ({
      id: String(doc?._id || ''),
      type: typeof doc?.type === 'string' ? doc.type : '',
      location: typeof doc?.location === 'string' ? doc.location : null,
      message: typeof doc?.message === 'string' ? doc.message : '',
      actorUserId:
        typeof doc?.actorUserId === 'string' ? doc.actorUserId : null,
      actorTelegramId: Number.isFinite(doc?.actorTelegramId)
        ? Number(doc.actorTelegramId)
        : null,
      targetUserId:
        typeof doc?.targetUserId === 'string' ? doc.targetUserId : null,
      teamId: typeof doc?.teamId === 'string' ? doc.teamId : null,
      teamName: typeof doc?.teamName === 'string' ? doc.teamName : '',
      gameId: typeof doc?.gameId === 'string' ? doc.gameId : null,
      gameName: typeof doc?.gameName === 'string' ? doc.gameName : '',
      metadata: doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {},
      createdAt: doc?.createdAt ? new Date(doc.createdAt).toISOString() : null,
    }),
  )

  return {
    events: items,
    hasMore,
  }
}
