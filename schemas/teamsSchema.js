const teamsSchema = {
  name: {
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
