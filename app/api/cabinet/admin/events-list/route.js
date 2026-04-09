import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'

const parsePositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const normalizeLocationFilters = (value) => {
  const source =
    typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? value.join(',')
        : ''

  if (!source.trim()) {
    return []
  }

  return Array.from(
    new Set(
      source
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item && item !== 'all'),
    ),
  )
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const requestUrl = new URL(request.url)
    const offset = parsePositiveInteger(
      requestUrl.searchParams.get('offset'),
      0,
    )
    const limit = parsePositiveInteger(requestUrl.searchParams.get('limit'), 20)
    const locationFilters = normalizeLocationFilters(
      requestUrl.searchParams.get('locations') ??
        requestUrl.searchParams.get('location'),
    )

    const query =
      locationFilters.length > 0 ? { location: { $in: locationFilters } } : {}
    const SiteEvents = db.model('SiteEvents')
    const docs = await SiteEvents.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit + 1)
      .lean()

    const hasMore = docs.length > limit
    const items = (hasMore ? docs.slice(0, limit) : docs).map((doc) => ({
      id: toStringId(doc?._id),
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
      metadata:
        doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {},
      createdAt: doc?.createdAt ? new Date(doc.createdAt).toISOString() : null,
    }))

    return NextResponse.json(
      {
        success: true,
        data: items,
        meta: {
          offset,
          limit,
          hasMore,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load admin site events list (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить список событий' },
      { status: 500 },
    )
  }
}
