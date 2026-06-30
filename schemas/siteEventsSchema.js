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
  },
  teamId: {
    type: String,
    default: null,
    trim: true,
    index: true,
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
