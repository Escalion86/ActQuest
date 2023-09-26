import mongoose from 'mongoose'
import lastCommandsSchema from '@schemas/lastCommandsSchema'
import mongooseLeanDefaults from 'mongoose-lean-defaults'

const LastCommandsSchema = new mongoose.Schema(lastCommandsSchema, {
  timestamps: true,
})
LastCommandsSchema.plugin(mongooseLeanDefaults)

export default mongoose.models.LastCommands ||
  mongoose.model('LastCommands', LastCommandsSchema)
