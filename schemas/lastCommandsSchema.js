const lastCommandsSchema = {
  userTelegramId: {
    type: Number,
    default: null,
    require: true,
  },
  command: {
    type: Map,
  },
}

export default lastCommandsSchema
