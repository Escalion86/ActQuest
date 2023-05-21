import mongoose from 'mongoose'
import teamsUsersSchema from '@schemas/teamsUsersSchema'

const TeamsUsersSchema = new mongoose.Schema(teamsUsersSchema, {
  timestamps: true,
})

export default mongoose.models.TeamsUsers ||
  mongoose.model('TeamsUsers', TeamsUsersSchema)
