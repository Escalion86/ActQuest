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
  pages: {
    type: Map,
    default: {},
  },
}

export default lastCommandsSchema
