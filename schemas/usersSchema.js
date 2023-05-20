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
    // required: [true, 'Введите Телефон'],
    default: null,
  },
}

export default usersSchema
