import mongoose from 'mongoose'
import gamesTeamsSchema from '@schemas/gamesTeamsSchema'

const GamesTeamsSchema = new mongoose.Schema(gamesTeamsSchema, {
  timestamps: true,
})

export default mongoose.models.GamesTeams ||
  mongoose.model('GamesTeams', GamesTeamsSchema)
