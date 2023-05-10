import mongoose from 'mongoose'
import teamsSchema from '@schemas/teamsSchema'

const TeamsSchema = new mongoose.Schema(teamsSchema, { timestamps: true })

export default mongoose.models.Teams || mongoose.model('Teams', TeamsSchema)
