const siteSettingsSchema = {
  supportPhone: { type: String, default: null },
  chatUrl: { type: String, default: null },
  supportPhonesByLocation: { type: Object, default: {} },
  chatUrlsByLocation: { type: Object, default: {} },
  allowSiteAuth: { type: Boolean, default: true },
  allowSiteRegistration: { type: Boolean, default: true },
  enableVkOneTap: { type: Boolean, default: true },
}

export default siteSettingsSchema
