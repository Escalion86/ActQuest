import mongoose from 'mongoose'
import teamsUsersSchema from '@schemas/teamsUsersSchema'
import mongooseLeanDefaults from 'mongoose-lean-defaults'

const TeamsUsersSchema = new mongoose.Schema(teamsUsersSchema, {
  timestamps: true,
})
TeamsUsersSchema.plugin(mongooseLeanDefaults)

export default mongoose.models.TeamsUsers ||
  mongoose.model('TeamsUsers', TeamsUsersSchema)
