const gamesPaymentsSchema = {
  gameId: {
    type: String,
    required: [true, 'Необходимо выбрать игру'],
  },
  sum: {
    type: Number,
    default: 0,
  },
  comment: {
    type: String,
    default: '',
  },
}

export default gamesPaymentsSchema
