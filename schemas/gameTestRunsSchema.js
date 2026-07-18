import gamesTeamsSchema from './gamesTeamsSchema'

const gameTestRunsSchema = {
  ...gamesTeamsSchema,
  ownerUserId: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },
  ownerTelegramId: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },
  testerRole: {
    type: String,
    enum: ['captain', 'participant'],
    default: 'captain',
  },
  gameSnapshot: {
    type: Object,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
}

export default gameTestRunsSchema
