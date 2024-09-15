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
          required: [true, 'Введите название уровня'],
          default: '',
          trim: true,
        },
        task: {
          type: String,
          default: '',
        },
        clues: [
          {
            clue: {
              type: String,
              default: '',
            },
            images: {
              type: [String],
              default: [],
            },
          },
        ],
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
  },
  finishingPlace: {
    type: String,
    default: '',
  },
  result: {
    type: {
      text: String,
      teams: [TeamsSchema],
      gameTeams: [GamesTeamsSchema],
      teamsUsers: [TeamsUsersSchema],
    },
    default: null,
  },
  hideResult: {
    type: Boolean,
    default: false,
  },
  prices: {
    type: [{ id: String, name: String, price: Number }],
    default: [],
  },
}

export default gamesSchema
