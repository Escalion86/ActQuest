import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const notificationsSchema = {
  userId: {
    type: String,
    required: true,
    index: true,
    set: normalizeIdForStorage,
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
