const siteSettingsSchema = {
  supportPhone: { type: String, default: null },
  chatUrl: { type: String, default: null },
  supportPhonesByLocation: { type: Object, default: {} },
  chatUrlsByLocation: { type: Object, default: {} },
  allowSiteAuth: { type: Boolean, default: true },
  allowSiteRegistration: { type: Boolean, default: true },
  allowSmsVerification: { type: Boolean, default: true },
  phoneVerificationPrimaryMethod: { type: String, enum: ['call', 'sms'], default: 'call' },
  assistantAiEnabled: { type: Boolean, default: false },
  enableVkOneTap: { type: Boolean, default: true },
}

export default siteSettingsSchema
