import { Schema } from 'mongoose'

const gameStagesSchema = {
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, index: true },
  seasonId: { type: String, default: null },
  seasonName: { type: String, default: null },
  dateStart: { type: Date, default: null },
  participationMode: { type: String, enum: ['team', 'player'], default: 'team' },
  isRated: { type: Boolean, default: true },
  fallbackGameIds: { type: [Schema.Types.ObjectId], default: [] },
  result: { type: Schema.Types.Mixed, default: null },
  publishedAt: { type: Date, default: null },
  registrationLock: { type: Schema.Types.Mixed, default: null, select: false },
}

export default gameStagesSchema
