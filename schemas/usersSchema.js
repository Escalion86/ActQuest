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
}

export default usersSchema
