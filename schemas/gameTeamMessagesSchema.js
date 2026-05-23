const gameTeamMessagesSchema = {
  gameId: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  teamId: {
    type: String,
    default: null,
    index: true,
    trim: true,
  },
  scope: {
    type: String,
    required: true,
    enum: ['game', 'team'],
    index: true,
  },
  direction: {
    type: String,
    required: true,
    enum: ['admin_to_team', 'team_to_admin'],
    index: true,
  },
  body: {
    type: String,
    required: true,
    trim: true,
  },
  createdByUserId: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  createdByRole: {
    type: String,
    required: true,
    enum: ['admin', 'moder', 'dev', 'captain', 'liaison'],
  },
  createdByName: {
    type: String,
    default: '',
    trim: true,
  },
  pushRequested: {
    type: Boolean,
    default: false,
  },
  pushUsersMatched: {
    type: Number,
    default: 0,
  },
  pushNotificationsCreated: {
    type: Number,
    default: 0,
  },
  pushDelivered: {
    type: Number,
    default: 0,
  },
  pushError: {
    type: String,
    default: null,
  },
  readByAdminAt: {
    type: Date,
    default: null,
    index: true,
  },
  teamReads: {
    type: [
      {
        teamId: {
          type: String,
          required: true,
          trim: true,
        },
        readAt: {
          type: Date,
          required: true,
        },
      },
    ],
    default: [],
  },
  userReads: {
    type: [
      {
        teamId: {
          type: String,
          required: true,
          trim: true,
        },
        userKey: {
          type: String,
          required: true,
          trim: true,
          index: true,
        },
        readAt: {
          type: Date,
          required: true,
        },
      },
    ],
    default: [],
  },
}

export default gameTeamMessagesSchema
