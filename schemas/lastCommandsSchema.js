const lastCommandsSchema = {
  userTelegramId: {
    type: Number,
    default: null,
    require: true,
  },
  command: {
    type: String,
    default: null,
  },
}

export default lastCommandsSchema
