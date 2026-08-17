import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import {
  resolveSessionGameReviewIdentity,
  serializePublishedGameReview,
} from '@server/gameReviews'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i

const resolveGameId = async (params) => {
  const resolvedParams = await params
  const gameId =
    typeof resolvedParams?.gameId === 'string'
      ? resolvedParams.gameId.trim()
      : ''
  return OBJECT_ID_PATTERN.test(gameId) ? gameId : null
}

export async function GET(_request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const gameId = await resolveGameId(params)
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Некорректный идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Не удалось подключиться к базе данных')

    const GameReviewsModel = db.model('GameReviews')
    const { userId } = resolveSessionGameReviewIdentity(session.user)
    const [summaryRows, reviewDocs] = await Promise.all([
      GameReviewsModel.aggregate([
        { $match: { gameId, isRatingIncluded: { $ne: false } } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$overallRating' },
            averageDifficultyRating: { $avg: '$difficultyRating' },
            reviewsCount: { $sum: 1 },
          },
        },
      ]),
      GameReviewsModel.find({
        gameId,
        publicationConsent: true,
        $or: [
          { moderationStatus: 'approved' },
          ...(userId ? [{ userId }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ])

    const summary = summaryRows[0] || {}
    const averageRating = Number(summary.averageRating)
    const averageDifficultyRating = Number(summary.averageDifficultyRating)
    const items = reviewDocs
      .map((review) => {
        const serialized = serializePublishedGameReview(review)
        if (!serialized) return null
        const isOwn = Boolean(userId && String(review?.userId) === userId)
        return {
          ...serialized,
          isOwn,
          moderationStatus: isOwn ? review?.moderationStatus : undefined,
        }
      })
      .filter(Boolean)

    return NextResponse.json(
      {
        success: true,
        data: {
          items,
          meta: {
            reviewsCount: Number(summary.reviewsCount || 0),
            publishedReviewsCount: items.length,
            averageRating: Number.isFinite(averageRating)
              ? Number(averageRating.toFixed(1))
              : null,
            averageDifficultyRating:
              summary.averageDifficultyRating !== null &&
              summary.averageDifficultyRating !== undefined &&
              Number.isFinite(averageDifficultyRating)
                ? Number(averageDifficultyRating.toFixed(1))
                : null,
          },
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load published game reviews', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить отзывы' },
      { status: 500 },
    )
  }
}
