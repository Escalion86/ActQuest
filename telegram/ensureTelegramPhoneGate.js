import sendMessage from './sendMessage'
import { TELEGRAM_FALLBACK_TEXT } from './constants'

const hasPhoneValue = (phone) => {
  if (phone === null || phone === undefined) {
    return false
  }

  if (typeof phone === 'number') {
    return Number.isFinite(phone) && phone > 0
  }

  if (typeof phone === 'string') {
    return phone.trim().length > 0
  }

  return false
}

const ensureTelegramPhoneGate = async ({ telegramId, location, db, callback_query }) => {
  if (!telegramId || !db) {
    return false
  }

  const user = await db
    .model('Users')
    .findOne({ telegramId })
    .select({ _id: 1, phone: 1 })
    .lean()

  const hasPhone = hasPhoneValue(user?.phone)

  if (hasPhone || !user?._id) {
    await sendMessage({
      chat_id: telegramId,
      text: TELEGRAM_FALLBACK_TEXT,
      callback_query,
      remove_keyboard: true,
      location,
    })
    return { handled: true, shouldRequestPhone: false }
  }

  await sendMessage({
    chat_id: telegramId,
    text:
      'Для корректной авторизации нам теперь необходим номер телефона. Нажмите кнопку ниже и отправьте ваш контакт из Telegram.',
    keyboard: {
      keyboard: [
        [
          {
            text: 'Отправить мой номер телефона',
            request_contact: true,
          },
        ],
      ],
      one_time_keyboard: true,
    },
    location,
  })

  return { handled: true, shouldRequestPhone: true }
}

export default ensureTelegramPhoneGate
