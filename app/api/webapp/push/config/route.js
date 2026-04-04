import { NextResponse } from 'next/server'

const { ensureWebPushConfigured } = require('@server/pwaNotifications')

const normalizeString = (value) => {
  if (!value || typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

export async function GET() {
  const config = ensureWebPushConfigured()

  const configPublicKey = normalizeString(config?.publicKey)
  const publicKey =
    configPublicKey ||
    normalizeString(process.env.WEB_PUSH_PUBLIC_KEY) ||
    normalizeString(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY)

  const privateKey =
    typeof config?.hasPrivateKey === 'boolean'
      ? config.hasPrivateKey
      : Boolean(normalizeString(process.env.WEB_PUSH_PRIVATE_KEY))

  const contactValue =
    normalizeString(process.env.WEB_PUSH_CONTACT) ||
    normalizeString(process.env.WEB_PUSH_CONTACT_EMAIL) ||
    normalizeString(config?.subject)

  const moduleAvailable = config?.reason !== 'MODULE_UNAVAILABLE'

  const isConfigured = Boolean(
    config?.isReady || (publicKey && privateKey && contactValue && moduleAvailable),
  )

  return NextResponse.json(
    {
      success: true,
      publicKey,
      isConfigured,
      reason: config?.isReady ? null : config?.reason || null,
      details: {
        hasPublicKey: Boolean(publicKey),
        hasPrivateKey: Boolean(privateKey),
        hasContact: Boolean(contactValue),
        moduleAvailable,
      },
    },
    { status: 200 },
  )
}
