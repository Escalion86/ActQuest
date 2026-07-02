import { Schema } from 'mongoose'
import gamesTeamsSchema from './gamesTeamsSchema'
import teamsSchema from './teamsSchema'
import teamsUsersSchema from './teamsUsersSchema'

const TeamsSchema = new Schema(teamsSchema)
const GamesTeamsSchema = new Schema(gamesTeamsSchema)
const TeamsUsersSchema = new Schema(teamsUsersSchema)

const StoryMediaSchema = new Schema(
  {
    id: { type: String, trim: true },
    type: {
      type: String,
      enum: ['image', 'audio', 'video'],
      default: 'image',
    },
    url: { type: String, trim: true, default: '' },
    mime: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    path: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const StoryCoordinatesSchema = new Schema(
  {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    radius: { type: Number, default: null },
  },
  { _id: false },
)

const StoryItemSchema = new Schema(
  {
    id: { type: String, trim: true, required: true },
    title: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    descriptionRich: { type: String, default: '' },
    media: { type: [StoryMediaSchema], default: [] },
    position: {
      type: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
      },
      default: () => ({}),
    },
    consumableOnUse: { type: Boolean, default: false },
    hiddenUntilObtained: { type: Boolean, default: true },
  },
  { _id: false },
)

const StoryEndingSchema = new Schema(
  {
    id: { type: String, trim: true, required: true },
    title: { type: String, trim: true, default: '' },
    type: {
      type: String,
      enum: ['success', 'failed', 'neutral', 'secret'],
      default: 'success',
    },
    descriptionRich: { type: String, default: '' },
    media: { type: [StoryMediaSchema], default: [] },
    position: {
      type: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
      },
      default: () => ({}),
    },
    conditions: {
      type: {
        minScore: { type: Number, default: null },
        requiredItemIds: { type: [String], default: [] },
        requiredCompletedNodeIds: { type: [String], default: [] },
      },
      default: {},
    },
  },
  { _id: false },
)

const StoryNodeSchema = new Schema(
  {
    id: { type: String, trim: true, required: true },
    title: { type: String, trim: true, default: '' },
    descriptionRich: { type: String, default: '' },
    media: { type: [StoryMediaSchema], default: [] },
    coordinates: {
      type: StoryCoordinatesSchema,
      default: () => ({}),
    },
    position: {
      type: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
      },
      default: () => ({}),
    },
    visibility: {
      type: {
        startVisible: { type: Boolean, default: false },
        requiredNodeIds: { type: [String], default: [] },
        requiredItemIds: { type: [String], default: [] },
        requiredInputMode: {
          type: String,
          enum: ['all', 'any', 'count'],
          default: 'all',
        },
        requiredInputCount: { type: Number, default: 1 },
        hiddenUntilUnlocked: { type: Boolean, default: true },
      },
      default: () => ({}),
    },
    scoring: {
      type: {
        scoreForComplete: { type: Number, default: 0 },
      },
      default: () => ({}),
    },
    agentUserIds: {
      type: [String],
      default: [],
    },
    clues: {
      type: [
        {
          id: { type: String, trim: true, required: true },
          title: { type: String, trim: true, default: '' },
          contentRich: { type: String, default: '' },
          media: { type: [StoryMediaSchema], default: [] },
          scorePenalty: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    codes: {
      type: [
        {
          id: { type: String, trim: true, required: true },
          code: { type: String, trim: true, default: '' },
          type: {
            type: String,
            enum: ['complete', 'bonus', 'effect'],
            default: 'complete',
          },
          scoreBonus: { type: Number, default: 0 },
          scorePenalty: { type: Number, default: 0 },
          requiredItemIds: { type: [String], default: [] },
          grantsItemIds: { type: [String], default: [] },
          consumesItemIds: { type: [String], default: [] },
          unlocksNodeIds: { type: [String], default: [] },
          completesNode: { type: Boolean, default: true },
          endingId: { type: String, trim: true, default: null },
          resultMessageRich: { type: String, default: '' },
        },
      ],
      default: [],
    },
    actions: {
      type: [
        {
          id: { type: String, trim: true, required: true },
          label: { type: String, trim: true, default: '' },
          descriptionRich: { type: String, default: '' },
          requiredItemIds: { type: [String], default: [] },
          grantsItemIds: { type: [String], default: [] },
          consumesItemIds: { type: [String], default: [] },
          unlocksNodeIds: { type: [String], default: [] },
          scoreBonus: { type: Number, default: 0 },
          scorePenalty: { type: Number, default: 0 },
          completesNode: { type: Boolean, default: false },
          endingId: { type: String, trim: true, default: null },
          resultMessageRich: { type: String, default: '' },
        },
      ],
      default: [],
    },
  },
  { _id: false },
)

const StoryEdgeSchema = new Schema(
  {
    id: { type: String, trim: true, required: true },
    fromNodeId: { type: String, trim: true, default: null },
    fromItemId: { type: String, trim: true, default: null },
    toNodeId: { type: String, trim: true, required: true },
    type: {
      type: String,
      enum: [
        'required_node',
        'required_item',
        'unlock',
        'requires_item',
        'ending',
      ],
      default: 'required_node',
    },
    itemId: { type: String, trim: true, default: null },
    actionId: { type: String, trim: true, default: null },
    codeId: { type: String, trim: true, default: null },
  },
  { _id: false },
)

const PrequelMediaSchema = new Schema(
  {
    id: { type: String, trim: true },
    type: {
      type: String,
      enum: ['image', 'audio', 'video'],
      default: 'image',
    },
    url: { type: String, trim: true, default: '' },
    mime: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    path: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const PrequelStoryEffectSchema = new Schema(
  {
    id: { type: String, trim: true, required: true },
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
  },
  { _id: false },
)

const PrequelCodeSchema = new Schema(
  {
    id: { type: String, trim: true },
    code: { type: String, trim: true, default: '' },
    value: { type: Number, default: 0 },
    description: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    storyEffects: {
      type: [PrequelStoryEffectSchema],
      default: [],
    },
  },
  { _id: false },
)

const gamesSchema = {
  name: {
    type: String,
    required: [true, 'Введите название игры'],
    default: '',
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  descriptionRich: {
    type: String,
    default: '',
  },
  descriptionMedia: {
    type: [
      {
        id: { type: String, trim: true },
        type: {
          type: String,
          enum: ['image', 'audio', 'video'],
          default: 'image',
        },
        url: { type: String, trim: true, default: '' },
        mime: { type: String, trim: true, default: '' },
        size: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
        path: { type: String, trim: true, default: '' },
        title: { type: String, trim: true, default: '' },
      },
    ],
    default: [],
  },
  prequel: {
    type: {
      enabled: { type: Boolean, default: false },
      openAt: { type: Date, default: null },
      description: { type: String, default: '', trim: true },
      descriptionRich: { type: String, default: '' },
      descriptionMedia: {
        type: [PrequelMediaSchema],
        default: [],
      },
      mode: {
        type: String,
        enum: ['single_hit', 'multi_hit'],
        default: 'multi_hit',
      },
      bonusCodes: {
        type: [PrequelCodeSchema],
        default: [],
      },
      penaltyCodes: {
        type: [PrequelCodeSchema],
        default: [],
      },
      wrongAttemptsLimit: {
        type: Number,
        default: null,
      },
      wrongAttemptsPenalty: {
        type: Number,
        default: 0,
      },
      wrongAttemptsStoryEffects: {
        type: [PrequelStoryEffectSchema],
        default: [],
      },
    },
    default: () => ({}),
  },
  dateStart: {
    type: Date,
    default: null,
  },
  dateStartFact: {
    type: Date,
    default: null,
  },
  dateEndFact: {
    type: Date,
    default: null,
  },
  location: {
    type: String,
    default: null,
    trim: true,
  },
  seasonId: {
    type: String,
    default: null,
    trim: true,
  },
  seasonName: {
    type: String,
    default: null,
    trim: true,
  },
  image: {
    type: String,
    default: null,
  },
  tasks: {
    type: [
      {
        title: {
          type: String,
          default: '',
          trim: true,
        },
        task: {
          type: String,
          default: '',
          trim: true,
        },
        howToSolve: {
          type: String,
          default: '',
          trim: true,
        },
        taskRich: {
          type: String,
          default: '',
        },
        taskMedia: {
          type: [
            {
              id: { type: String, trim: true },
              type: {
                type: String,
                enum: ['image', 'audio', 'video'],
                default: 'image',
              },
              url: { type: String, trim: true, default: '' },
              mime: { type: String, trim: true, default: '' },
              size: { type: Number, default: 0 },
              duration: { type: Number, default: 0 },
              path: { type: String, trim: true, default: '' },
              title: { type: String, trim: true, default: '' },
            },
          ],
          default: [],
        },
        taskBonusForComplite: {
          type: Number,
          default: 0,
        },
        clues: [
          {
            clue: {
              type: String,
              default: '',
              trim: true,
            },
            clueRich: {
              type: String,
              default: '',
            },
            images: {
              type: [String],
              default: [],
            },
          },
        ],
        subTasks: {
          type: [
            {
              name: { type: String, trim: true },
              task: { type: String, trim: true },
              bonus: Number,
            },
          ],
          default: [],
        },
        images: {
          type: [String],
          default: [],
        },
        codes: {
          type: [{ type: String, trim: true }],
          default: [],
        },
        codePhotos: {
          type: [{ type: String, trim: true }],
          default: [],
        },
        coordinates: {
          latitude: Number, // Широта
          longitude: Number, // Долгота
          radius: Number,
        },
        penaltyCodes: {
          type: [
            {
              code: { type: String, trim: true },
              penalty: Number,
              description: { type: String, trim: true },
              image: { type: String, trim: true, default: '' },
            },
          ],
          default: [],
        },
        bonusCodes: {
          type: [
            {
              code: { type: String, trim: true },
              bonus: Number,
              description: { type: String, trim: true },
              image: { type: String, trim: true, default: '' },
            },
          ],
          default: [],
        },
        numCodesToCompliteTask: {
          type: Number,
          default: null,
        },
        postMessage: {
          type: String,
          default: '',
          trim: true,
        },
        postMessageRich: {
          type: String,
          default: '',
        },
        postMessageMedia: {
          type: [
            {
              id: { type: String, trim: true },
              type: {
                type: String,
                enum: ['image', 'audio', 'video'],
                default: 'image',
              },
              url: { type: String, trim: true, default: '' },
              mime: { type: String, trim: true, default: '' },
              size: { type: Number, default: 0 },
              duration: { type: Number, default: 0 },
              path: { type: String, trim: true, default: '' },
              title: { type: String, trim: true, default: '' },
            },
          ],
          default: [],
        },
        canceled: {
          type: Boolean,
          default: false,
        },
        isBonusTask: {
          type: Boolean,
          default: false,
        },
        agentUserIds: {
          type: [String],
          default: [],
        },
      },
    ],
    default: [],
  },
  taskDistributionMode: {
    type: String,
    enum: ['linear', 'random'],
    default: 'linear',
  },
  taskDistributionTemplate: {
    type: [[Number]],
    default: [],
  },
  type: {
    type: String,
    default: 'classic',
  },
  storyConfig: {
    type: {
      nodeLabel: { type: String, trim: true, default: 'Локация' },
      startMode: {
        type: String,
        enum: ['common', 'individual'],
        default: 'common',
      },
      hideTotalNodes: { type: Boolean, default: true },
      hideTotalItems: { type: Boolean, default: true },
      showInventory: { type: Boolean, default: true },
      showScoreToTeam: { type: Boolean, default: false },
      showFinalHistoryToTeam: { type: Boolean, default: false },
    },
    default: () => ({}),
  },
  storyItems: {
    type: [StoryItemSchema],
    default: [],
  },
  storyNodes: {
    type: [StoryNodeSchema],
    default: [],
  },
  storyEdges: {
    type: [StoryEdgeSchema],
    default: [],
  },
  storyEndings: {
    type: [StoryEndingSchema],
    default: [],
  },
  taskDuration: {
    type: Number,
    default: 3600,
  },
  cluesDuration: {
    type: Number,
    default: 1200,
  },
  clueEarlyPenalty: {
    type: Number,
    default: 0,
  },
  clueEarlyAccessMode: {
    type: String,
    enum: ['penalty', 'time'],
    default: 'time',
  },
  allowCaptainForceClue: {
    type: Boolean,
    default: true,
  },
  allowCaptainFailTask: {
    type: Boolean,
    default: true,
  },
  allowCaptainFinishBreak: {
    type: Boolean,
    default: true,
  },
  breakDuration: {
    type: Number,
    default: 0,
  },
  taskFailurePenalty: {
    type: Number,
    default: 0,
  },
  manyCodesPenalty: {
    type: [Number, Number],
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'started', 'finished', 'closed', 'canceled'],
    default: 'active',
  },
  isRated: {
    type: Boolean,
    default: true,
  },
  hidden: {
    type: Boolean,
    default: true,
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  orderType: {
    type: String,
    enum: ['public', 'private', 'corporate'],
    default: 'public',
  },
  sourceOrderId: {
    type: String,
    default: null,
    trim: true,
  },
  clientName: {
    type: String,
    default: '',
    trim: true,
  },
  clientContact: {
    type: String,
    default: '',
    trim: true,
  },
  expectedParticipantsCount: {
    type: Number,
    default: null,
  },
  creatorUserId: {
    type: String,
    required: false,
    default: null,
    trim: true,
  },
  creatorTelegramId: {
    type: Number,
    required: false,
    default: null,
  },
  individualStart: {
    type: Boolean,
    default: false,
  },
  startingPlace: {
    type: String,
    default: '',
    trim: true,
  },
  finishingPlace: {
    type: String,
    default: '',
    trim: true,
  },
  showFinishingPlace: {
    type: Boolean,
    default: false,
  },
  result: {
    type: {
      text: String,
      teams: [TeamsSchema],
      gameTeams: [GamesTeamsSchema],
      teamsUsers: [TeamsUsersSchema],
      teamsPlaces: Map,
      computed: Schema.Types.Mixed,
    },
    default: null,
  },
  hideResult: {
    type: Boolean,
    default: false,
  },
  registrationOpen: {
    type: Boolean,
    default: true,
  },
  maxTeamPlayers: {
    type: Number,
    default: null,
    min: 1,
  },
  prices: {
    type: [{ id: String, name: { type: String, trim: true }, price: Number }],
    default: [],
  },
  finances: {
    type: [
      {
        id: { type: String, trim: true },
        type: { type: String, enum: ['income', 'expense'] },
        sum: { type: Number, default: 0 },
        date: { type: Date, default: null },
        description: { type: String, trim: true, default: '' },
      },
    ],
    default: [],
  },
  showEnterButton: {
    type: Boolean,
    default: false,
  },
  showTasks: {
    type: Boolean,
    default: false,
  },
  showCreator: {
    type: Boolean,
    default: true,
  },
  moderators: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Users' }],
    default: [],
  },
  agents: {
    type: [
      {
        userId: {
          type: String,
          required: true,
          trim: true,
        },
        active: {
          type: Boolean,
          default: true,
        },
      },
    ],
    default: [],
  },
  agentNotifications: {
    type: {
      onPreviousTask: { type: Boolean, default: true },
      onCurrentTask: { type: Boolean, default: true },
      onTaskCompleted: { type: Boolean, default: false },
      onAllTeamsPassed: { type: Boolean, default: true },
    },
    default: () => ({
      onPreviousTask: true,
      onCurrentTask: true,
      onTaskCompleted: false,
      onAllTeamsPassed: true,
    }),
  },
}

export default gamesSchema
