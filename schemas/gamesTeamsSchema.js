import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const gamesTeamsSchema = {
  teamId: {
    type: String,
    required: [true, 'Необходимо выбрать команду'],
    set: normalizeIdForStorage,
  },
  gameId: {
    type: String,
    required: [true, 'Необходимо указать id игры'],
    set: normalizeIdForStorage,
  },
  outOfCompetition: {
    type: Boolean,
    default: false,
  },
  paidGame: {
    type: Boolean,
    default: false,
  },
  activeNum: {
    type: Number,
    default: 0,
  },
  gameProcessLock: {
    type: {
      token: { type: String, default: null },
      acquiredAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
    },
    default: null,
  },
  taskDistributionTemplate: {
    type: [[Number]],
    default: [],
  },
  taskSequence: {
    type: [Number],
    default: [],
  },
  taskSequenceGeneratedAt: {
    type: Date,
    default: null,
  },
  taskSequenceSource: {
    type: String,
    enum: ['game_template', 'team_template', 'linear'],
    default: 'linear',
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
      usedActionIds: { type: [String], default: [] },
      prequelFlags: { type: [String], default: [] },
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
  prequelProgress: {
    type: {
      prequelId: { type: String, trim: true, default: '' },
      foundMainCodes: { type: [String], default: [] },
      foundBonusCodes: { type: [String], default: [] },
      foundPenaltyCodes: { type: [String], default: [] },
      wrongCodes: { type: [String], default: [] },
      attempts: {
        type: [
          {
            id: { type: String, trim: true },
            code: { type: String, default: '' },
            normalizedCode: { type: String, trim: true, default: '' },
            category: {
              type: String,
              enum: ['main', 'bonus', 'penalty', 'wrong'],
              default: 'wrong',
            },
            matchedCode: { type: String, trim: true, default: '' },
            source: {
              type: String,
              enum: ['player', 'admin'],
              default: 'player',
            },
            actorUserId: { type: String, trim: true, default: null },
            createdAt: { type: Date, default: null },
          },
        ],
        default: [],
      },
      wrongPenaltyAppliedCount: { type: Number, default: 0 },
      appliedAdjustments: {
        type: [
          {
            id: { type: String, trim: true },
            type: {
              type: String,
              enum: ['bonus', 'penalty'],
              default: 'penalty',
            },
            source: {
              type: String,
              enum: [
                'bonus_code',
                'penalty_code',
                'wrong_attempts_limit',
                'completion_bonus',
              ],
              default: 'bonus_code',
            },
            code: { type: String, trim: true, default: '' },
            codeId: { type: String, trim: true, default: '' },
            value: { type: Number, default: 0 },
            description: { type: String, trim: true, default: '' },
            createdAt: { type: Date, default: null },
          },
        ],
        default: [],
      },
      appliedStoryEffects: {
        type: [
          {
            id: { type: String, trim: true },
            effectId: { type: String, trim: true, default: '' },
            source: {
              type: String,
              enum: [
                'bonus_code',
                'penalty_code',
                'wrong_attempts_limit',
                'completion_bonus',
              ],
              default: 'bonus_code',
            },
            code: { type: String, trim: true, default: '' },
            type: {
              type: String,
              enum: ['grant_item', 'unlock_node', 'set_flag', 'score_modifier'],
              default: 'grant_item',
            },
            itemId: { type: String, trim: true, default: '' },
            nodeId: { type: String, trim: true, default: '' },
            flagKey: { type: String, trim: true, default: '' },
            flagValue: { type: Boolean, default: true },
            value: { type: Number, default: 0 },
            label: { type: String, trim: true, default: '' },
            appliedAt: { type: Date, default: null },
          },
        ],
        default: [],
      },
      isClosed: { type: Boolean, default: false },
      closedReason: { type: String, trim: true, default: null },
      completedAt: { type: Date, default: null },
      completedSource: {
        type: String,
        enum: ['codes', 'manual'],
        default: null,
      },
      completedByUserId: { type: String, trim: true, default: null },
      completionBonusApplied: { type: Boolean, default: false },
      lastSubmittedAt: { type: Date, default: null },
    },
    default: null,
  },
  prequelProgresses: {
    type: [
      {
        prequelId: { type: String, trim: true, required: true },
        foundMainCodes: { type: [String], default: [] },
        foundBonusCodes: { type: [String], default: [] },
        foundPenaltyCodes: { type: [String], default: [] },
        wrongCodes: { type: [String], default: [] },
        attempts: {
          type: [
            {
              id: { type: String, trim: true },
              code: { type: String, default: '' },
              normalizedCode: { type: String, trim: true, default: '' },
              category: {
                type: String,
                enum: ['main', 'bonus', 'penalty', 'wrong'],
                default: 'wrong',
              },
              matchedCode: { type: String, trim: true, default: '' },
              source: {
                type: String,
                enum: ['player', 'admin'],
                default: 'player',
              },
              actorUserId: { type: String, trim: true, default: null },
              createdAt: { type: Date, default: null },
            },
          ],
          default: [],
        },
        wrongPenaltyAppliedCount: { type: Number, default: 0 },
        appliedAdjustments: {
          type: [
            {
              id: { type: String, trim: true },
              type: {
                type: String,
                enum: ['bonus', 'penalty'],
                default: 'penalty',
              },
              source: {
                type: String,
                enum: [
                  'bonus_code',
                  'penalty_code',
                  'wrong_attempts_limit',
                  'completion_bonus',
                ],
                default: 'bonus_code',
              },
              code: { type: String, trim: true, default: '' },
              codeId: { type: String, trim: true, default: '' },
              value: { type: Number, default: 0 },
              description: { type: String, trim: true, default: '' },
              createdAt: { type: Date, default: null },
            },
          ],
          default: [],
        },
        appliedStoryEffects: {
          type: [
            {
              id: { type: String, trim: true },
              effectId: { type: String, trim: true, default: '' },
              source: {
                type: String,
                enum: [
                  'bonus_code',
                  'penalty_code',
                  'wrong_attempts_limit',
                  'completion_bonus',
                ],
                default: 'bonus_code',
              },
              code: { type: String, trim: true, default: '' },
              type: {
                type: String,
                enum: ['grant_item', 'unlock_node', 'set_flag', 'score_modifier'],
                default: 'grant_item',
              },
              itemId: { type: String, trim: true, default: '' },
              nodeId: { type: String, trim: true, default: '' },
              flagKey: { type: String, trim: true, default: '' },
              flagValue: { type: Boolean, default: true },
              value: { type: Number, default: 0 },
              label: { type: String, trim: true, default: '' },
              appliedAt: { type: Date, default: null },
            },
          ],
          default: [],
        },
        isClosed: { type: Boolean, default: false },
        closedReason: { type: String, trim: true, default: null },
        completedAt: { type: Date, default: null },
        completedSource: {
          type: String,
          enum: ['codes', 'manual'],
          default: null,
        },
        completedByUserId: { type: String, trim: true, default: null },
        completionBonusApplied: { type: Boolean, default: false },
        lastSubmittedAt: { type: Date, default: null },
      },
    ],
    default: [],
  },
  timerId: String,
}

export default gamesTeamsSchema
