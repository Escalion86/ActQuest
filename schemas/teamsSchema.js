const teamsSchema = {
  name: {
    type: String,
    default: 'Команда Х',
    required: true,
  },
  description: {
    type: String,
    default: 'Описание команды',
  },
  open: {
    type: Boolean,
    default: true,
  },
}

export default teamsSchema
