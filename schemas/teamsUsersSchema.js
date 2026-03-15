const teamsUsersSchema = {
  teamId: {
    type: String,
    required: [true, 'Необходимо выбрать команду'],
  },
  userId: {
    type: String,
    required: false,
    default: null,
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
