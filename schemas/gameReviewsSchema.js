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
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
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
