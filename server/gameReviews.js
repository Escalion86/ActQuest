import { toStringId } from '../helpers/idAndDate.js'

export const GAME_REVIEW_TAGS = [
  'interesting_tasks',
  'atmosphere',
  'organization',
  'story',
  'route_and_locations',
  'teamwork',
  'unexpected_moments',
  'actors',
]

const REVIEW_TEXT_MAX_LENGTH = 1500

export const resolveSessionGameReviewIdentity = (sessionUser) => ({
  userId: toStringId(
    sessionUser?.globalUserId ??
      sessionUser?.userId ??
      sessionUser?._id ??
      sessionUser?.id,
  ),
  telegramId: Number.isFinite(Number(sessionUser?.telegramId))
    ? Number(sessionUser.telegramId)
    : null,
})

export const findGameReviewMembership = ({ game, userId, telegramId }) => {
  const memberships = Array.isArray(game?.result?.teamsUsers)
    ? game.result.teamsUsers
    : []

  return (
    memberships.find((membership) => {
      if (userId && toStringId(membership?.userId) === userId) {
        return true
      }
      return (
        telegramId !== null &&
        Number(membership?.userTelegramId) === telegramId
      )
    }) ?? null
  )
}

const normalizeText = (value) =>
  typeof value === 'string'
    ? value.trim().slice(0, REVIEW_TEXT_MAX_LENGTH)
    : ''

export const normalizeGameReviewInput = (body) => {
  const overallRating = Number(body?.overallRating)
  if (
    !Number.isInteger(overallRating) ||
    overallRating < 1 ||
    overallRating > 10
  ) {
    return {
      success: false,
      error: 'Оценка должна быть целым числом от 1 до 10',
    }
  }

  const difficultyRating = Number(body?.difficultyRating)
  if (
    !Number.isInteger(difficultyRating) ||
    difficultyRating < 1 ||
    difficultyRating > 10
  ) {
    return {
      success: false,
      error: 'Оценка сложности должна быть целым числом от 1 до 10',
    }
  }

  const allowedTags = new Set(GAME_REVIEW_TAGS)
  const tags = Array.from(
    new Set(
      (Array.isArray(body?.tags) ? body.tags : [])
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter((tag) => allowedTags.has(tag)),
    ),
  )

  return {
    success: true,
    data: {
      overallRating,
      difficultyRating,
      tags,
      likedText: normalizeText(body?.likedText),
      improvementText: normalizeText(body?.improvementText),
      publicationConsent: body?.publicationConsent === true,
    },
  }
}

export const serializeGameReview = (review) => {
  if (!review) return null
  return {
    id: toStringId(review?._id),
    gameId: toStringId(review?.gameId),
    userId: toStringId(review?.userId),
    teamId: toStringId(review?.teamId),
    location: typeof review?.location === 'string' ? review.location : '',
    gameType:
      typeof review?.gameType === 'string' ? review.gameType : 'classic',
    overallRating: Number(review?.overallRating),
    difficultyRating:
      review?.difficultyRating !== null &&
      review?.difficultyRating !== undefined &&
      Number.isFinite(Number(review.difficultyRating))
        ? Number(review.difficultyRating)
        : null,
    tags: Array.isArray(review?.tags) ? review.tags : [],
    likedText: typeof review?.likedText === 'string' ? review.likedText : '',
    improvementText:
      typeof review?.improvementText === 'string'
        ? review.improvementText
        : '',
    publicationConsent: review?.publicationConsent === true,
    isRatingIncluded: review?.isRatingIncluded !== false,
    ratingExclusionReason:
      typeof review?.ratingExclusionReason === 'string'
        ? review.ratingExclusionReason
        : '',
    ratingExcludedByUserId: toStringId(review?.ratingExcludedByUserId),
    ratingExcludedAt: review?.ratingExcludedAt
      ? new Date(review.ratingExcludedAt).toISOString()
      : null,
    moderationStatus:
      typeof review?.moderationStatus === 'string'
        ? review.moderationStatus
        : 'pending',
    moderationReason:
      typeof review?.moderationReason === 'string'
        ? review.moderationReason
        : '',
    createdAt: review?.createdAt
      ? new Date(review.createdAt).toISOString()
      : null,
    updatedAt: review?.updatedAt
      ? new Date(review.updatedAt).toISOString()
      : null,
  }
}

export const serializePublishedGameReview = (review) => {
  const serialized = serializeGameReview(review)
  if (!serialized) return null

  return {
    id: serialized.id,
    overallRating: serialized.overallRating,
    difficultyRating: serialized.difficultyRating,
    tags: serialized.tags,
    likedText: serialized.likedText,
    improvementText: serialized.improvementText,
    isRatingIncluded: serialized.isRatingIncluded,
    createdAt: serialized.createdAt,
  }
}
