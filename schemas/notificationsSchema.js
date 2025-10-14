const notificationsSchema = {
  userTelegramId: {
    type: Number,
    required: true,
    index: true,
  },
  location: {
    type: String,
    required: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    default: '',
  },
  data: {
    type: Object,
    default: {},
  },
  tag: {
    type: String,
    default: null,
  },
  readAt: {
    type: Date,
    default: null,
  },
}

export default notificationsSchema
