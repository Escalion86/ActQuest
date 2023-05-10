const teamsSchema = {
  capitanId: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  name_lowered: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  open: {
    type: Boolean,
    default: true,
  },
}

export default teamsSchema
