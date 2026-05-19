const gamesTeamsSchema = {
  teamId: {
    type: String,
    required: [true, 'Необходимо выбрать команду'],
  },
  gameId: {
    type: String,
    required: [true, 'Необходимо указать id игры'],
  },
  outOfCompetition: {
    type: Boolean,
    default: false,
  },
  activeNum: {
    type: Number,
    default: 0,
  },
  findedCodes: [[String]],
  wrongCodes: [[String]],
  timeAddings: [
    {
      id: String,
      name: String,
      time: Number,
      taskId: String,
      taskIndex: Number,
      source: String,
      scope: {
        type: String,
        enum: ['total_adjustment', 'task_elapsed'],
        default: 'total_adjustment',
      },
      showInAdjustments: {
        type: Boolean,
        default: true,
      },
      createdAt: Date,
    },
  ],
  findedPenaltyCodes: [[String]],
  findedBonusCodes: [[String]],
  codeAttempts: [
    {
      taskIndex: Number,
      code: String,
      category: {
        type: String,
        enum: ['main', 'bonus', 'penalty', 'wrong'],
        default: 'wrong',
      },
      status: {
        type: String,
        enum: ['accepted', 'rejected'],
        default: 'rejected',
      },
      source: {
        type: String,
        enum: ['telegram', 'web'],
        default: 'web',
      },
      createdAt: Date,
    },
  ],
  startTime: [Date],
  endTime: [Date],
  forcedClues: [Number],
  taskFailures: [
    {
      taskIndex: Number,
      taskId: String,
      failedAt: Date,
      source: {
        type: String,
        enum: ['captain', 'admin', 'system', 'timeout'],
        default: 'captain',
      },
      reason: String,
    },
  ],
  photos: [{ photos: [String], checks: Map }],
  storyProgress: {
    type: {
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started',
      },
      startedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
      currentEndingId: { type: String, trim: true, default: null },
      unlockedNodeIds: { type: [String], default: [] },
      completedNodeIds: { type: [String], default: [] },
      inventory: {
        type: [
          {
            itemId: { type: String, trim: true },
            status: {
              type: String,
              enum: ['active', 'consumed'],
              default: 'active',
            },
            obtainedAt: { type: Date, default: null },
            sourceNodeId: { type: String, trim: true, default: null },
            consumedAt: { type: Date, default: null },
            consumedAtNodeId: { type: String, trim: true, default: null },
            consumedByActionId: { type: String, trim: true, default: null },
          },
        ],
        default: [],
      },
      score: { type: Number, default: 0 },
      usedClueIds: { type: [String], default: [] },
      usedCodeIds: { type: [String], default: [] },
      usedBonusCodeIds: { type: [String], default: [] },
      history: {
        type: [
          {
            id: { type: String, trim: true },
            type: { type: String, trim: true },
            at: { type: Date, default: null },
            nodeId: { type: String, trim: true, default: null },
            itemId: { type: String, trim: true, default: null },
            actionId: { type: String, trim: true, default: null },
            codeId: { type: String, trim: true, default: null },
            clueId: { type: String, trim: true, default: null },
            endingId: { type: String, trim: true, default: null },
            points: { type: Number, default: 0 },
            message: { type: String, default: '' },
            actor: {
              type: String,
              enum: ['team', 'admin', 'system'],
              default: 'system',
            },
          },
        ],
        default: [],
      },
    },
    default: null,
  },
  timerId: String,
}

export default gamesTeamsSchema
