import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const siteEventsSchema = {
  type: {
    type: String,
    required: true,
    trim: true,
    index: true,
    enum: [
      'user_registered',
      'team_created',
      'team_deleted',
      'team_registered_to_game',
      'team_unregistered_from_game',
      'game_order_created',
      'game_review_submitted',
      'client_diagnostic',
    ],
  },
  location: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },
  message: {
    type: String,
    default: '',
    trim: true,
  },
  actorUserId: {
    type: String,
    default: null,
    trim: true,
    index: true,
    set: normalizeIdForStorage,
  },
  actorTelegramId: {
    type: Number,
    default: null,
    index: true,
  },
  targetUserId: {
    type: String,
    default: null,
    trim: true,
    index: true,
    set: normalizeIdForStorage,
  },
  teamId: {
    type: String,
    default: null,
    trim: true,
    index: true,
    set: normalizeIdForStorage,
  },
  teamName: {
    type: String,
    default: '',
    trim: true,
  },
  gameId: {
    type: String,
    default: null,
    trim: true,
    index: true,
    set: normalizeIdForStorage,
  },
  gameName: {
    type: String,
    default: '',
    trim: true,
  },
  metadata: {
    type: Object,
    default: {},
  },
}

export default siteEventsSchema
