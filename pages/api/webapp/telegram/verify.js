import authenticateTelegramUser from '@helpers/authenticateTelegramUser'

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, errorMessage: 'Метод не поддерживается.' })
  }

  const { location, data } = req.body || {}

  try {
    const result = await authenticateTelegramUser({ location, rawData: data })

    if (result.success) {
      return res.status(200).json({
        success: true,
        user: {
          telegramId: result.user.telegramId,
          name: result.user.name,
          username: result.user.username,
        },
      })
    }

    const status = result.errorCode === 'DB_CONNECTION_FAILED' ? 500 : 400

    return res.status(status).json({
      success: false,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      details: result.details ?? null,
    })
  } catch (error) {
    console.error('Telegram debug verify error', error)
    return res.status(500).json({
      success: false,
      errorCode: 'UNEXPECTED_ERROR',
      errorMessage: 'Непредвиденная ошибка при проверке данных авторизации Telegram.',
    })
  }
}

export default handler
