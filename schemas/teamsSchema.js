const teamsSchema = {
  name: {
    type: String,
    required: true,
    trim: true,
  },
  name_lowered: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  open: {
    type: Boolean,
    default: true,
  },
}

export default teamsSchema
