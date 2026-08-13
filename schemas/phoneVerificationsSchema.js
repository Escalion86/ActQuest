const phoneVerificationsSchema = {
  phone: {
    type: Number,
    required: true,
    index: true,
  },
  flow: {
    type: String,
    required: true,
    enum: ['register', 'recovery', 'change_phone'],
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
  verificationMethod: {
    type: String,
    enum: ['call', 'sms'],
    default: 'call',
  },
  smsCodeHash: {
    type: String,
    default: null,
  },
  smsCodeSalt: {
    type: String,
    default: null,
  },
  smsAttempts: {
    type: Number,
    default: 0,
  },
  smsSentAt: {
    type: Date,
    default: null,
  },
  callExpiresAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    expires: 0,
  },
  finalizingAt: {
    type: Date,
    default: null,
  },
  meta: {
    type: Object,
    default: null,
  },
}

export default phoneVerificationsSchema
