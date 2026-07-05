import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const gameOrdersSchema = {
  companyName: {
    type: String,
    default: '',
    trim: true,
  },
  contactName: {
    type: String,
    required: [true, 'Введите имя контактного лица'],
    default: '',
    trim: true,
  },
  phone: {
    type: String,
    default: '',
    trim: true,
  },
  email: {
    type: String,
    default: '',
    trim: true,
    lowercase: true,
  },
  telegram: {
    type: String,
    default: '',
    trim: true,
  },
  location: {
    type: String,
    required: [true, 'Выберите город'],
    default: '',
    trim: true,
    lowercase: true,
  },
  preferredDate: {
    type: Date,
    default: null,
  },
  preferredTime: {
    type: String,
    default: '',
    trim: true,
  },
  participantsCount: {
    type: Number,
    default: null,
    min: 1,
  },
  gameType: {
    type: String,
    enum: ['classic', 'photo', 'story', 'any'],
    default: 'any',
  },
  selectedGameId: {
    type: String,
    default: null,
    trim: true,
    set: normalizeIdForStorage,
  },
  comment: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'confirmed', 'converted', 'canceled'],
    default: 'new',
  },
  createdByUserId: {
    type: String,
    default: null,
    trim: true,
    set: normalizeIdForStorage,
  },
  convertedGameId: {
    type: String,
    default: null,
    trim: true,
    set: normalizeIdForStorage,
  },
  managerComment: {
    type: String,
    default: '',
    trim: true,
  },
}

export default gameOrdersSchema
