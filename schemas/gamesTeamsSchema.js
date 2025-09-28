const gamesTeamsSchema = {
  teamId: {
    type: String,
    required: [true, 'Необходимо выбрать команду'],
  },
  gameId: {
    type: String,
    required: [true, 'Необходимо указать id игры'],
  },
  activeNum: {
    type: Number,
    default: 0,
  },
  findedCodes: [[String]],
  wrongCodes: [[String]],
  timeAddings: [{ id: String, name: String, time: Number }],
  findedPenaltyCodes: [[String]],
  findedBonusCodes: [[String]],
  startTime: [Date],
  endTime: [Date],
  forcedClues: [Number],
  photos: [{ photos: [String], checks: Map }],
  timerId: String,
}

export default gamesTeamsSchema
