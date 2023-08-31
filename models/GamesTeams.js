import mongoose from 'mongoose'
import gamesTeamsSchema from '@schemas/gamesTeamsSchema'
import mongooseLeanDefaults from 'mongoose-lean-defaults'

const GamesTeamsSchema = new mongoose.Schema(gamesTeamsSchema, {
  timestamps: true,
})
GamesTeamsSchema.plugin(mongooseLeanDefaults)

export default mongoose.models.GamesTeams ||
  mongoose.model('GamesTeams', GamesTeamsSchema)
