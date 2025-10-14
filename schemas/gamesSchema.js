import { Schema } from 'mongoose'
import gamesTeamsSchema from './gamesTeamsSchema'
import teamsSchema from './teamsSchema'
import teamsUsersSchema from './teamsUsersSchema'

const TeamsSchema = new Schema(teamsSchema)
const GamesTeamsSchema = new Schema(gamesTeamsSchema)
const TeamsUsersSchema = new Schema(teamsUsersSchema)

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
  image: {
    type: String,
    default: null,
  },
  tasks: {
    type: [
      {
        title: {
          type: String,
          required: [true, 'Введите название задания'],
          default: '',
          trim: true,
        },
        task: {
          type: String,
          default: '',
          trim: true,
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
        canceled: {
          type: Boolean,
          default: false,
        },
        isBonusTask: {
          type: Boolean,
          default: false,
        },
      },
    ],
    default: [],
  },
  type: {
    type: String,
    default: 'classic',
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
    default: 'active',
  },
  hidden: {
    type: Boolean,
    default: true,
  },
  creatorTelegramId: {
    type: Number,
    required: [true, 'Введите telegramId'],
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
  result: {
    type: {
      text: String,
      teams: [TeamsSchema],
      gameTeams: [GamesTeamsSchema],
      teamsUsers: [TeamsUsersSchema],
      teamsPlaces: Map,
    },
    default: null,
  },
  hideResult: {
    type: Boolean,
    default: false,
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
  showTasks: {
    type: Boolean,
    default: false,
  },
  showCreator: {
    type: Boolean,
    default: true,
  },
}

export default gamesSchema
