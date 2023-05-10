const lastCommandsSchema = {
  id: {
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
