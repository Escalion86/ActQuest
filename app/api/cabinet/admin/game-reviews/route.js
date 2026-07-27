import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { toStringId } from '@helpers/idAndDate'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import {
  resolveSessionGameReviewIdentity,
  serializeGameReview,
} from '@server/gameReviews'

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i
const MODERATION_STATUSES = new Set(['pending', 'approved', 'rejected'])

const parseNonNegativeInteger = (value, fallback) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0
    ? Math.floor(numeric)
    : fallback
}

const buildQuery = (request) => {
  const requestUrl = new URL(request.url)
  const query = {}
  const location = String(requestUrl.searchParams.get('location') || '')
    .trim()
    .toLowerCase()
  const moderationStatus = String(
    requestUrl.searchParams.get('moderationStatus') || '',
  )
    .trim()
    .toLowerCase()
  const rating = Number(requestUrl.searchParams.get('rating'))

  if (location && location !== 'all') query.location = location
  if (MODERATION_STATUSES.has(moderationStatus)) {
    query.moderationStatus = moderationStatus
  }
  if (Number.isInteger(rating) && rating >= 1 && rating <= 10) {
    query.overallRating = rating
  }

  return {
    query,
    offset: parseNonNegativeInteger(requestUrl.searchParams.get('offset'), 0),
    limit: Math.min(
      parseNonNegativeInteger(requestUrl.searchParams.get('limit'), 20),
      100,
    ),
  }
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
    if (!db) throw new Error('Не удалось подключиться к базе данных')

    const { query, offset, limit } = buildQuery(request)
    const GameReviews = db.model('GameReviews')
    const [reviewDocs, total, summaryRows] = await Promise.all([
      GameReviews.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      GameReviews.countDocuments(query),
      GameReviews.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$overallRating' },
            publicationConsentCount: {
              $sum: { $cond: ['$publicationConsent', 1, 0] },
            },
          },
        },
      ]),
    ])

    const gameIds = Array.from(
      new Set(reviewDocs.map((item) => toStringId(item?.gameId)).filter(Boolean)),
    )
    const userIds = Array.from(
      new Set(
        reviewDocs
          .map((item) => toStringId(item?.userId))
          .filter((id) => id && OBJECT_ID_PATTERN.test(id)),
      ),
    )
    const teamIds = Array.from(
      new Set(
        reviewDocs
          .map((item) => toStringId(item?.teamId))
          .filter((id) => id && OBJECT_ID_PATTERN.test(id)),
      ),
    )

    const [games, users, teams] = await Promise.all([
      gameIds.length
        ? db
            .model('Games')
            .find({ _id: { $in: gameIds } })
            .select({ _id: 1, name: 1, dateStart: 1 })
            .lean()
        : [],
      userIds.length
        ? db
            .model('Users')
            .find({ _id: { $in: userIds } })
            .select({ _id: 1, name: 1, username: 1 })
            .lean()
        : [],
      teamIds.length
        ? db
            .model('Teams')
            .find({ _id: { $in: teamIds } })
            .select({ _id: 1, name: 1 })
            .lean()
        : [],
    ])

    const gameById = new Map(games.map((game) => [toStringId(game?._id), game]))
    const userById = new Map(users.map((user) => [toStringId(user?._id), user]))
    const teamById = new Map(teams.map((team) => [toStringId(team?._id), team]))
    const items = reviewDocs.map((doc) => {
      const review = serializeGameReview(doc)
      const game = gameById.get(review.gameId)
      const user = userById.get(review.userId)
      const team = teamById.get(review.teamId)
      return {
        ...review,
        gameName:
          typeof game?.name === 'string' ? game.name : 'Игра не найдена',
        gameDate: game?.dateStart
          ? new Date(game.dateStart).toISOString()
          : null,
        userName:
          typeof user?.name === 'string' && user.name.trim()
            ? user.name.trim()
            : typeof user?.username === 'string' && user.username.trim()
              ? `@${user.username.trim()}`
              : 'Игрок',
        teamName:
          typeof team?.name === 'string' && team.name.trim()
            ? team.name.trim()
            : 'Команда не найдена',
      }
    })
    const summary = summaryRows[0] || {}

    return NextResponse.json(
      {
        success: true,
        data: items,
        meta: {
          offset,
          limit,
          total,
          hasMore: offset + items.length < total,
          averageRating: Number.isFinite(summary.averageRating)
            ? Number(summary.averageRating.toFixed(1))
            : null,
          publicationConsentCount: Number(
            summary.publicationConsentCount || 0,
          ),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load admin game reviews', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить отзывы' },
      { status: 500 },
    )
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const reviewId = typeof body?.reviewId === 'string' ? body.reviewId.trim() : ''
  const moderationStatus =
    typeof body?.moderationStatus === 'string'
      ? body.moderationStatus.trim().toLowerCase()
      : ''
  if (!OBJECT_ID_PATTERN.test(reviewId) || !MODERATION_STATUSES.has(moderationStatus)) {
    return NextResponse.json(
      { success: false, error: 'Некорректные параметры модерации' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Не удалось подключиться к базе данных')

    const moderator = resolveSessionGameReviewIdentity(session.user)
    const review = await db.model('GameReviews').findByIdAndUpdate(
      reviewId,
      {
        $set: {
          moderationStatus,
          moderatedByUserId: moderator.userId,
          moderatedAt: new Date(),
        },
      },
      { returnDocument: 'after', runValidators: true },
    )

    if (!review) {
      return NextResponse.json(
        { success: false, error: 'Отзыв не найден' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { success: true, data: { review: serializeGameReview(review) } },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to moderate game review', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить отзыв' },
      { status: 500 },
    )
  }
}
