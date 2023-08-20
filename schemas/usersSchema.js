const usersSchema = {
  telegramId: {
    type: Number,
    required: [true, 'Введите telegramId'],
    default: null,
  },
  name: {
    type: String,
    default: '',
  },
  gender: {
    type: String,
    default: null,
  },
  phone: {
    type: Number,
    default: null,
  },
}

export default usersSchema
