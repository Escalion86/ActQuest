import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const gamesPaymentsSchema = {
  gameId: {
    type: String,
    required: [true, 'Необходимо выбрать игру'],
    set: normalizeIdForStorage,
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
