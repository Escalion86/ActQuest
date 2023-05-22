const gamesSchema = {
  name: {
    type: String,
    required: [true, 'Введите название игры'],
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  dateStart: {
    type: Date,
    default: null,
  },
  dateEnd: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    default: 'active',
  },
}

export default gamesSchema
