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
  durationBetweenClues: {
    type: Number,
    default: 1200,
  },
  breakDurationBetweenTasks: {
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
}

export default gamesSchema
