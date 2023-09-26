import mongoose from 'mongoose'
import teamsSchema from '@schemas/teamsSchema'
import mongooseLeanDefaults from 'mongoose-lean-defaults'

const TeamsSchema = new mongoose.Schema(teamsSchema, { timestamps: true })
TeamsSchema.plugin(mongooseLeanDefaults)

export default mongoose.models.Teams || mongoose.model('Teams', TeamsSchema)
