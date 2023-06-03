const gamesTeamsSchema = {
  teamId: {
    type: String,
    required: [true, 'Необходимо выбрать команду'],
  },
  gameId: {
    type: String,
    required: [true, 'Необходимо указать id игры'],
  },
  // tasks: {
  activeNum: {
    type: Number,
    default: 0,
  },
  findedCodes: [[String]],
  startTime: [Date],
  endTime: [Date],
  timerId: String,
  // },
}

export default gamesTeamsSchema
