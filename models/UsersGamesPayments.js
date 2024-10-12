import mongoose from 'mongoose'
import usersGamesPaymentsSchema from '@schemas/usersGamesPaymentsSchema'
import mongooseLeanDefaults from 'mongoose-lean-defaults'

const UsersGamesPaymentsSchema = new mongoose.Schema(usersGamesPaymentsSchema, {
  timestamps: true,
})
UsersGamesPaymentsSchema.plugin(mongooseLeanDefaults)

export default mongoose.models.UsersGamesPayments ||
  mongoose.model('UsersGamesPayments', UsersGamesPaymentsSchema)
