import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const isDeveloperRole = (role) =>
  typeof role === 'string' && role.trim().toLowerCase() === 'dev'

const normalizeLimit = (value, fallback = 1000, max = 10000) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback
  }

  return Math.min(Math.trunc(numeric), max)
}

const requireDeveloper = async () => {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Недостаточно прав' },
        { status: 403 },
      ),
    }
  }

  return { ok: true }
}

const buildStats = async ({ notificationsCollection }) => {
  const [total, withUserId, withoutUserId, withLegacyTelegramId] =
    await Promise.all([
      notificationsCollection.countDocuments({}),
      notificationsCollection.countDocuments({
        userId: { $exists: true, $nin: [null, ''] },
      }),
      notificationsCollection.countDocuments({
        $or: [{ userId: { $exists: false } }, { userId: { $in: [null, ''] } }],
      }),
      notificationsCollection.countDocuments({
        userTelegramId: { $exists: true, $ne: null },
      }),
    ])

  return {
    total,
    withUserId,
    withoutUserId,
    withLegacyTelegramId,
  }
}

const getBackfillCandidates = async ({
  notificationsCollection,
  usersCollectionName,
  limit,
}) =>
  notificationsCollection
    .aggregate([
      {
        $match: {
          $or: [
            { userId: { $exists: false } },
            { userId: { $in: [null, ''] } },
          ],
          userTelegramId: { $exists: true, $ne: null },
        },
      },
      {
        $lookup: {
          from: usersCollectionName,
          localField: 'userTelegramId',
          foreignField: 'telegramId',
          as: 'matchedUsers',
        },
      },
      {
        $unwind: '$matchedUsers',
      },
      {
        $project: {
          _id: 1,
          userId: { $toString: '$matchedUsers._id' },
        },
      },
      {
        $limit: limit,
      },
    ])
    .toArray()

export async function GET(request) {
  const access = await requireDeveloper()
  if (!access.ok) return access.response

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Не удалось подключиться к базе данных' },
        { status: 503 },
      )
    }

    const notificationsModel = db.model('Notifications')
    const usersModel = db.model('Users')
    const notificationsCollection = notificationsModel.collection
    const usersCollectionName = usersModel.collection?.name || 'users'
    const url = new URL(request.url)
    const limit = normalizeLimit(url.searchParams.get('limit'), 100, 1000)

    const [stats, candidates] = await Promise.all([
      buildStats({ notificationsCollection }),
      getBackfillCandidates({
        notificationsCollection,
        usersCollectionName,
        limit,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        backfillableSampleCount: candidates.length,
        sampleIds: candidates.slice(0, 20).map((item) => String(item._id)),
      },
    })
  } catch (error) {
    console.error('Notifications migration check failed', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось проверить уведомления' },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  const access = await requireDeveloper()
  if (!access.ok) return access.response

  try {
    const body = (await request.json().catch(() => ({}))) || {}
    const limit = normalizeLimit(body?.limit, 5000, 50000)
    const cleanupLegacy = body?.cleanupLegacy !== false

    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Не удалось подключиться к базе данных' },
        { status: 503 },
      )
    }

    const notificationsModel = db.model('Notifications')
    const usersModel = db.model('Users')
    const notificationsCollection = notificationsModel.collection
    const usersCollectionName = usersModel.collection?.name || 'users'

    const before = await buildStats({ notificationsCollection })
    const candidates = await getBackfillCandidates({
      notificationsCollection,
      usersCollectionName,
      limit,
    })

    let backfilled = 0
    for (const candidate of candidates) {
      const result = await notificationsCollection.updateOne(
        { _id: candidate._id },
        { $set: { userId: String(candidate.userId) } },
      )
      backfilled += Number(result?.modifiedCount || 0)
    }

    let legacyUnset = 0
    if (cleanupLegacy) {
      const cleanupResult = await notificationsCollection.updateMany(
        {
          userId: { $exists: true, $nin: [null, ''] },
          userTelegramId: { $exists: true },
        },
        { $unset: { userTelegramId: '' } },
      )
      legacyUnset = Number(cleanupResult?.modifiedCount || 0)
    }

    const after = await buildStats({ notificationsCollection })

    return NextResponse.json({
      success: true,
      data: {
        before,
        after,
        backfilled,
        legacyUnset,
        limit,
        cleanupLegacy,
      },
    })
  } catch (error) {
    console.error('Notifications migration apply failed', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить уведомления' },
      { status: 500 },
    )
  }
}
