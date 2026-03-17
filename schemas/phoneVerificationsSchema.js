const phoneVerificationsSchema = {
  phone: {
    type: Number,
    required: true,
    index: true,
  },
  flow: {
    type: String,
    required: true,
    enum: ['register', 'recovery'],
    default: 'register',
    index: true,
  },
  callId: {
    type: Number,
    required: true,
    index: true,
  },
  authPhone: {
    type: String,
    default: null,
  },
  imageUrl: {
    type: String,
    default: null,
  },
  confirmed: {
    type: Boolean,
    default: false,
    index: true,
  },
  providerStatus: {
    type: String,
    default: 'pending',
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  meta: {
    type: Object,
    default: null,
  },
}

export default phoneVerificationsSchema
