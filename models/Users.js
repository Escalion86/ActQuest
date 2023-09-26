import mongoose from 'mongoose'
import usersSchema from '@schemas/usersSchema'
import mongooseLeanDefaults from 'mongoose-lean-defaults'

const UsersSchema = new mongoose.Schema(usersSchema, { timestamps: true })
UsersSchema.plugin(mongooseLeanDefaults)

export default mongoose.models.Users || mongoose.model('Users', UsersSchema)
