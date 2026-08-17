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
  const difficultyRating = Number(
    requestUrl.searchParams.get('difficultyRating'),
  )
  const gameId = String(requestUrl.searchParams.get('gameId') || '').trim()
  const ratingIncluded = String(
    requestUrl.searchParams.get('ratingIncluded') || '',
  )
    .trim()
    .toLowerCase()

  if (location && location !== 'all') query.location = location
  if (MODERATION_STATUSES.has(moderationStatus)) {
    query.moderationStatus = moderationStatus
  }
  if (Number.isInteger(rating) && rating >= 1 && rating <= 10) {
    query.overallRating = rating
  }
  if (
    Number.isInteger(difficultyRating) &&
    difficultyRating >= 1 &&
    difficultyRating <= 10
  ) {
    query.difficultyRating = difficultyRating
  }
  if (OBJECT_ID_PATTERN.test(gameId)) query.gameId = gameId
  if (ratingIncluded === 'included') {
    query.isRatingIncluded = { $ne: false }
  } else if (ratingIncluded === 'excluded') {
    query.isRatingIncluded = false
  }

  return {
    query,
    gameId: OBJECT_ID_PATTERN.test(gameId) ? gameId : null,
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

    const { query, gameId: selectedGameId, offset, limit } = buildQuery(request)
    const GameReviews = db.model('GameReviews')
    const gameOptionsQuery = { ...query }
    delete gameOptionsQuery.gameId
    const [reviewDocs, total, summaryRows, gameOptionIdsRaw] = await Promise.all([
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
            averageRating: {
              $avg: {
                $cond: [
                  { $ne: ['$isRatingIncluded', false] },
                  '$overallRating',
                  null,
                ],
              },
            },
            averageDifficultyRating: {
              $avg: {
                $cond: [
                  { $ne: ['$isRatingIncluded', false] },
                  '$difficultyRating',
                  null,
                ],
              },
            },
            ratingIncludedCount: {
              $sum: {
                $cond: [{ $ne: ['$isRatingIncluded', false] }, 1, 0],
              },
            },
            ratingExcludedCount: {
              $sum: {
                $cond: [{ $eq: ['$isRatingIncluded', false] }, 1, 0],
              },
            },
            publicationConsentCount: {
              $sum: { $cond: ['$publicationConsent', 1, 0] },
            },
          },
        },
      ]),
      GameReviews.distinct('gameId', gameOptionsQuery),
    ])

    const gameOptionIds = Array.from(
      new Set(
        [...gameOptionIdsRaw, selectedGameId]
          .map(toStringId)
          .filter((id) => id && OBJECT_ID_PATTERN.test(id)),
      ),
    )
    const gameIds = Array.from(
      new Set([
        ...reviewDocs.map((item) => toStringId(item?.gameId)).filter(Boolean),
        ...gameOptionIds,
      ]),
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
    const gameOptions = games
      .filter((game) => gameOptionIds.includes(toStringId(game?._id)))
      .map((game) => ({
        id: toStringId(game?._id),
        name:
          typeof game?.name === 'string' && game.name.trim()
            ? game.name.trim()
            : 'Без названия',
        dateStart: game?.dateStart
          ? new Date(game.dateStart).toISOString()
          : null,
      }))
      .sort((first, second) => {
        const firstTime = first.dateStart
          ? new Date(first.dateStart).getTime()
          : 0
        const secondTime = second.dateStart
          ? new Date(second.dateStart).getTime()
          : 0
        return secondTime - firstTime || first.name.localeCompare(second.name, 'ru')
      })

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
          averageDifficultyRating: Number.isFinite(
            summary.averageDifficultyRating,
          )
            ? Number(summary.averageDifficultyRating.toFixed(1))
            : null,
          publicationConsentCount: Number(
            summary.publicationConsentCount || 0,
          ),
          ratingIncludedCount: Number(summary.ratingIncludedCount || 0),
          ratingExcludedCount: Number(summary.ratingExcludedCount || 0),
          games: gameOptions,
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
  const hasModerationUpdate = MODERATION_STATUSES.has(moderationStatus)
  const moderationReason =
    typeof body?.moderationReason === 'string'
      ? body.moderationReason.trim().slice(0, 500)
      : ''
  const hasRatingUpdate = typeof body?.ratingIncluded === 'boolean'
  const ratingExclusionReason =
    typeof body?.ratingExclusionReason === 'string'
      ? body.ratingExclusionReason.trim().slice(0, 500)
      : ''
  if (
    !OBJECT_ID_PATTERN.test(reviewId) ||
    (!hasModerationUpdate && !hasRatingUpdate) ||
    (hasModerationUpdate &&
      moderationStatus === 'rejected' &&
      !moderationReason) ||
    (hasRatingUpdate && body.ratingIncluded === false && !ratingExclusionReason)
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          hasModerationUpdate && moderationStatus === 'rejected'
            ? 'Укажите причину отклонения отзыва'
            : hasRatingUpdate && body.ratingIncluded === false
            ? 'Укажите причину исключения оценки'
            : 'Некорректные параметры модерации',
      },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Не удалось подключиться к базе данных')

    const moderator = resolveSessionGameReviewIdentity(session.user)
    const update = {}
    if (hasModerationUpdate) {
      update.moderationStatus = moderationStatus
      update.moderationReason =
        moderationStatus === 'rejected' ? moderationReason : ''
      update.moderatedByUserId = moderator.userId
      update.moderatedAt = new Date()
    }
    if (hasRatingUpdate) {
      update.isRatingIncluded = body.ratingIncluded
      update.ratingExclusionReason =
        body.ratingIncluded === false ? ratingExclusionReason : ''
      update.ratingExcludedByUserId =
        body.ratingIncluded === false ? moderator.userId : null
      update.ratingExcludedAt =
        body.ratingIncluded === false ? new Date() : null
    }
    const review = await db.model('GameReviews').findByIdAndUpdate(
      reviewId,
      {
        $set: update,
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
