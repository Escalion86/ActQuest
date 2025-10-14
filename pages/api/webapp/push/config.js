const normalizePublicKey = (value) => {
  if (!value || typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается.' })
  }

  const publicKey =
    normalizePublicKey(process.env.WEB_PUSH_PUBLIC_KEY) ||
    normalizePublicKey(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY)

  const privateKey = normalizePublicKey(process.env.WEB_PUSH_PRIVATE_KEY)
  const contact = normalizePublicKey(process.env.WEB_PUSH_CONTACT)

  return res.status(200).json({
    success: true,
    publicKey,
    isConfigured: Boolean(publicKey && privateKey && contact),
  })
}
