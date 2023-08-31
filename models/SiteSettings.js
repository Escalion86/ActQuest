import mongoose from 'mongoose'
import siteSettingsSchema from '@schemas/siteSettingsSchema'
import mongooseLeanDefaults from 'mongoose-lean-defaults'

const SiteSettingsSchema = new mongoose.Schema(siteSettingsSchema, {
  timestamps: true,
})
SiteSettingsSchema.plugin(mongooseLeanDefaults)

export default mongoose.models.SiteSettings ||
  mongoose.model('SiteSettings', SiteSettingsSchema)
