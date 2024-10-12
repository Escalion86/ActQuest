const usersGamesPaymentsSchema = {
  userTelegramId: {
    type: String,
    required: [true, 'Необходимо выбрать пользователя'],
  },
  gameId: {
    type: String,
    required: [true, 'Необходимо выбрать игру'],
  },
  sum: {
    type: Number,
    default: 0,
  },
}

export default usersGamesPaymentsSchema
