const usersSchema = {
  telegramId: {
    type: Number,
    required: [true, 'Введите telegramId'],
    default: null,
  },
  name: {
    type: String,
    default: '',
    trim: true,
  },
  username: {
    type: String,
    default: null,
    trim: true,
  },
  photoUrl: {
    type: String,
    default: null,
  },
  languageCode: {
    type: String,
    default: null,
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  gender: {
    type: String,
    default: null,
  },
  phone: {
    type: Number,
    default: null,
  },
  about: {
    type: String,
    default: '',
    trim: true,
  },
  preferences: {
    type: [String],
    default: [],
  },
  location: {
    type: {
      date: Date,
      latitude: Number,
      longitude: Number,
      live_period: Number,
      heading: Number,
      horizontal_accuracy: Number,
    },
  },
  role: {
    type: String,
    default: 'client',
  },
  pushSubscriptions: {
    type: [
      {
        endpoint: {
          type: String,
          required: true,
        },
        keys: {
          type: {
            p256dh: {
              type: String,
              required: true,
            },
            auth: {
              type: String,
              required: true,
            },
          },
          required: true,
        },
        expirationTime: {
          type: Number,
          default: null,
        },
        userAgent: {
          type: String,
          default: null,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    default: [],
  },
}

export default usersSchema
