const lastCommandsSchema = {
  userTelegramId: {
    type: Number,
    default: null,
    require: true,
  },
  command: {
    type: Map,
  },
  prevCommand: {
    type: Map,
  },
  messageId: {
    type: Number,
  },
}

export default lastCommandsSchema
