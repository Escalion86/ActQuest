import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const usersGamesPaymentsSchema = {
  userTelegramId: {
    type: Number,
    required: [true, 'Необходимо выбрать пользователя'],
  },
  gameId: {
    type: String,
    required: [true, 'Необходимо выбрать игру'],
    set: normalizeIdForStorage,
  },
  sum: {
    type: Number,
    default: 0,
  },
}

export default usersGamesPaymentsSchema
