import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const gameReviewsSchema = {
  gameId: {
    type: String,
    required: true,
    set: normalizeIdForStorage,
  },
  userId: {
    type: String,
    required: true,
    set: normalizeIdForStorage,
  },
  teamId: {
    type: String,
    required: true,
    set: normalizeIdForStorage,
  },
  location: {
    type: String,
    default: '',
  },
  gameType: {
    type: String,
    enum: ['classic', 'photo', 'story'],
    default: 'classic',
  },
  overallRating: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
  difficultyRating: {
    type: Number,
    min: 1,
    max: 10,
    default: null,
  },
  tags: {
    type: [String],
    default: [],
  },
  likedText: {
    type: String,
    default: '',
  },
  improvementText: {
    type: String,
    default: '',
  },
  publicationConsent: {
    type: Boolean,
    default: false,
  },
  isRatingIncluded: {
    type: Boolean,
    default: true,
  },
  ratingExclusionReason: {
    type: String,
    default: '',
  },
  ratingExcludedByUserId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  ratingExcludedAt: {
    type: Date,
    default: null,
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  moderationReason: {
    type: String,
    default: '',
  },
  moderatedByUserId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  moderatedAt: {
    type: Date,
    default: null,
  },
}

export default gameReviewsSchema
