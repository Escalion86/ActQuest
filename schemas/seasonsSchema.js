const seasonsSchema = {
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameLowered: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: String,
    required: true,
    trim: true,
  },
}

export default seasonsSchema
