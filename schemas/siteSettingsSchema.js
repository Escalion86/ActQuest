const siteSettingsSchema = {
  supportPhone: { type: String, default: null },
  chatUrl: { type: String, default: null },
  allowSiteAuth: { type: Boolean, default: true },
  allowSiteRegistration: { type: Boolean, default: true },
  enableVkOneTap: { type: Boolean, default: true },
}

export default siteSettingsSchema
