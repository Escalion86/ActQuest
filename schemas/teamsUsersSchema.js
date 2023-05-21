const teamsUsersSchema = {
  teamId: {
    type: String,
    required: [true, 'Необходимо выбрать команду'],
  },
  userTelegramId: {
    type: String,
    required: [true, 'Необходимо указать телеграм id пользователя'],
  },
  role: {
    type: String,
    default: 'participant',
  },
}

export default teamsUsersSchema
