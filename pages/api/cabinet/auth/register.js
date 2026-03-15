import registerPhoneUser from '@helpers/registerPhoneUser'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const { location, data } = req.body || {}

  try {
    const result = await registerPhoneUser({
      location,
      rawData: data,
    })

    if (!result.success) {
      return res.status(400).json({
        success: false,
        errorCode: result.errorCode,
        error: result.errorMessage,
      })
    }

    return res.status(200).json({
      success: true,
      user: result.user,
    })
  } catch (error) {
    console.error('Phone registration API error', error)
    return res.status(500).json({
      success: false,
      error: 'Не удалось выполнить регистрацию. Попробуйте позже.',
    })
  }
}
