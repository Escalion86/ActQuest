import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import {
  buildGameReviewSiteEventMessage,
  shouldNotifyAdminsAboutGameReview,
} from '@helpers/adminEventNotifications'
import logSiteEvent from '@helpers/logSiteEvent'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import {
  findGameReviewMembership,
  normalizeGameReviewInput,
  resolveSessionGameReviewIdentity,
  serializeGameReview,
} from '@server/gameReviews'

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i
const REVIEWABLE_STATUSES = new Set(['finished', 'closed'])

const loadReviewContext = async ({ db, gameId, sessionUser }) => {
  const identity = resolveSessionGameReviewIdentity(sessionUser)
  if (!identity.userId) {
    return { error: 'Не удалось определить пользователя', status: 400 }
  }

  const game = await db
    .model('Games')
    .findById(gameId)
    .select({
      _id: 1,
      name: 1,
      location: 1,
      type: 1,
      status: 1,
      'result.teamsUsers': 1,
    })
    .lean()

  if (!game) {
    return { error: 'Игра не найдена', status: 404 }
  }

  const membership = findGameReviewMembership({
    game,
    userId: identity.userId,
    telegramId: identity.telegramId,
  })
  const isFinished = REVIEWABLE_STATUSES.has(String(game?.status || ''))

  return {
    identity,
    game,
    membership,
    eligible: Boolean(isFinished && membership),
    eligibilityReason: !isFinished
      ? 'Отзыв можно оставить после завершения игры'
      : !membership
        ? 'Отзыв доступен только участникам этой игры'
        : null,
  }
}

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

    const context = await loadReviewContext({
      db,
      gameId,
      sessionUser: session.user,
    })
    if (context.error) {
      return NextResponse.json(
        { success: false, error: context.error },
        { status: context.status },
      )
    }

    const review = await db
      .model('GameReviews')
      .findOne({ gameId, userId: context.identity.userId })
      .lean()

    return NextResponse.json(
      {
        success: true,
        data: {
          eligible: context.eligible,
          eligibilityReason: context.eligibilityReason,
          review: serializeGameReview(review),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game review', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить отзыв' },
      { status: 500 },
    )
  }
}

export async function PUT(request, { params }) {
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

  const body = await request.json().catch(() => ({}))
  const normalizedInput = normalizeGameReviewInput(body)
  if (!normalizedInput.success) {
    return NextResponse.json(
      { success: false, error: normalizedInput.error },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Не удалось подключиться к базе данных')

    const context = await loadReviewContext({
      db,
      gameId,
      sessionUser: session.user,
    })
    if (context.error) {
      return NextResponse.json(
        { success: false, error: context.error },
        { status: context.status },
      )
    }
    if (!context.eligible) {
      return NextResponse.json(
        { success: false, error: context.eligibilityReason },
        { status: 403 },
      )
    }

    const input = normalizedInput.data
    const reviewFilter = { gameId, userId: context.identity.userId }
    const existingReview = await db
      .model('GameReviews')
      .findOne(reviewFilter)
      .select({ _id: 1, moderationStatus: 1 })
      .lean()
    const review = await db.model('GameReviews').findOneAndUpdate(
      reviewFilter,
      {
        $set: {
          ...input,
          teamId: String(context.membership.teamId),
          location:
            typeof context.game?.location === 'string'
              ? context.game.location.trim().toLowerCase()
              : '',
          gameType: ['classic', 'photo', 'story'].includes(context.game?.type)
            ? context.game.type
            : 'classic',
          moderationStatus: 'pending',
          moderationReason: '',
          moderatedByUserId: null,
          moderatedAt: null,
        },
        $setOnInsert: {
          gameId,
          userId: context.identity.userId,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    )

    const shouldNotifyAdmins = shouldNotifyAdminsAboutGameReview(existingReview)
    if (shouldNotifyAdmins) {
      const isResubmission = Boolean(existingReview)
      const gameName =
        typeof context.game?.name === 'string' && context.game.name.trim()
          ? context.game.name.trim()
          : 'Без названия'
      await logSiteEvent({
        db,
        type: 'game_review_submitted',
        location: context.game?.location,
        message: buildGameReviewSiteEventMessage({
          gameName,
          overallRating: input.overallRating,
          difficultyRating: input.difficultyRating,
          isResubmission,
        }),
        actorUserId: context.identity.userId,
        teamId: context.membership?.teamId,
        gameId,
        gameName,
        metadata: {
          reviewId: String(review?._id || ''),
          overallRating: input.overallRating,
          difficultyRating: input.difficultyRating,
          isResubmission,
        },
        notificationTitle: isResubmission
          ? 'Отзыв повторно отправлен на проверку'
          : 'Новый отзыв об игре',
        notificationUrl: '/cabinet/admin/reviews',
      })
    }

    return NextResponse.json(
      { success: true, data: { review: serializeGameReview(review) } },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to save game review', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить отзыв' },
      { status: 500 },
    )
  }
}
