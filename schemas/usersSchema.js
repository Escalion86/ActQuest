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
}

export default usersSchema
