import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const gameHistoryEntriesSchema = {
  gameId: {
    type: String,
    required: true,
    trim: true,
    index: true,
    set: normalizeIdForStorage,
  },
  location: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },
  actionType: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  entityScope: {
    type: String,
    default: 'mixed',
    trim: true,
  },
  summary: {
    type: String,
    default: '',
    trim: true,
  },
  actor: {
    type: {
      userId: {
        type: String,
        default: null,
        trim: true,
        set: normalizeIdForStorage,
      },
      telegramId: { type: String, default: null, trim: true },
      role: { type: String, default: '', trim: true },
      name: { type: String, default: '', trim: true },
    },
    default: () => ({}),
  },
  warnings: {
    type: [String],
    default: [],
  },
  before: {
    type: Object,
    default: null,
  },
  after: {
    type: Object,
    default: null,
  },
  diff: {
    type: [
      {
        path: { type: String, trim: true },
        label: { type: String, trim: true },
        kind: { type: String, trim: true },
        beforeValue: { type: Object, default: null },
        afterValue: { type: Object, default: null },
      },
    ],
    default: [],
  },
  snapshot: {
    type: Object,
    default: null,
  },
  rollback: {
    type: Object,
    default: null,
  },
}

export default gameHistoryEntriesSchema
