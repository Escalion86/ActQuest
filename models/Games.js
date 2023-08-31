import mongoose from 'mongoose'
import gamesSchema from '@schemas/gamesSchema'
import mongooseLeanDefaults from 'mongoose-lean-defaults'

const GamesSchema = new mongoose.Schema(gamesSchema, { timestamps: true })
GamesSchema.plugin(mongooseLeanDefaults)

export default mongoose.models.Games || mongoose.model('Games', GamesSchema)
