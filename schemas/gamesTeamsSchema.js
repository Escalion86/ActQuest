const gamesTeamsSchema = {
  teamId: {
    type: String,
    required: [true, 'Необходимо выбрать команду'],
  },
  gameId: {
    type: String,
    required: [true, 'Необходимо указать id игры'],
  },
}

export default gamesTeamsSchema
