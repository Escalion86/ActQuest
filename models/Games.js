import mongoose from 'mongoose'
import gamesSchema from '@schemas/gamesSchema'

const GamesSchema = new mongoose.Schema(gamesSchema, { timestamps: true })

export default mongoose.models.Games || mongoose.model('Games', GamesSchema)
