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
  photos: [{ photos: [String], checks: Map }],
  timerId: String,
}

export default gamesTeamsSchema
