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
  },
  description: {
    type: String,
    default: '',
  },
  dateStart: {
    type: Date,
    default: null,
  },
  dateEnd: {
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
          type: [String],
          default: [],
        },
        numCodesToCompliteTask: {
          type: Number,
          default: null,
        },
      },
    ],
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
  breakDuration: {
    type: Number,
    default: 0,
  },
  taskFailurePenalty: {
    type: Number,
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
  result: {
    type: {
      text: String,
      teams: [TeamsSchema],
      gameTeams: [GamesTeamsSchema],
      teamsUsers: [TeamsUsersSchema],
    },
    default: null,
  },
}

export default gamesSchema
