import mongoose from 'mongoose'
import lastCommandsSchema from '@schemas/lastCommandsSchema'

const LastCommandsSchema = new mongoose.Schema(lastCommandsSchema, {
  timestamps: true,
})

export default mongoose.models.LastCommands ||
  mongoose.model('LastCommands', LastCommandsSchema)
