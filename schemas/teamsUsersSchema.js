import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const teamsUsersSchema = {
  teamId: {
    type: String,
    required: [true, 'Необходимо выбрать команду'],
    set: normalizeIdForStorage,
  },
  userId: {
    type: String,
    required: false,
    default: null,
    set: normalizeIdForStorage,
  },
  userTelegramId: {
    type: Number,
    required: false,
    default: null,
  },
  role: {
    type: String,
    default: 'participant',
  },
}

export default teamsUsersSchema
