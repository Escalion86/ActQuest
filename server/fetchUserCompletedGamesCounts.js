import { toStringId } from '@helpers/idAndDate'
import { COMPLETED_PARTICIPATION_STATUSES } from '@helpers/gameParticipation'

const fetchUserCompletedGamesCounts = async ({ db, userIds }) => {
  const normalizedUserIds = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((userId) => toStringId(userId))
        .filter(Boolean),
    ),
  )

  if (!db || normalizedUserIds.length === 0) {
    return new Map()
  }

  const rows = await db.model('Games').aggregate([
    {
      $match: {
        status: { $in: COMPLETED_PARTICIPATION_STATUSES },
        'result.teamsUsers.userId': { $in: normalizedUserIds },
      },
    },
    { $unwind: '$result.teamsUsers' },
    {
      $match: {
        'result.teamsUsers.userId': { $in: normalizedUserIds },
      },
    },
    {
      $group: {
        _id: {
          userId: '$result.teamsUsers.userId',
          gameId: '$_id',
        },
      },
    },
    {
      $group: {
        _id: '$_id.userId',
        count: { $sum: 1 },
      },
    },
  ])

  return new Map(
    rows
      .map((row) => [toStringId(row?._id), Number(row?.count) || 0])
      .filter(([userId]) => Boolean(userId)),
  )
}

export default fetchUserCompletedGamesCounts

