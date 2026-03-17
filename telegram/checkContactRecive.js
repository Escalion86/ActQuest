import sendMessage from './sendMessage'
import { TELEGRAM_FALLBACK_TEXT } from './constants'

const checkContactRecive = async (message, location, db) => {
  if (!message?.contact) return false
  const { contact, from } = message

  if (contact) {
    const { phone_number, first_name, last_name, user_id } = contact
    if (Number(user_id) !== Number(from?.id)) {
      await sendMessage({
        chat_id: from?.id,
        text: 'Нужно отправить именно ваш контакт из Telegram.',
        location,
      })
      return true
    }

    const name = (first_name + (last_name ? ' ' + last_name : '')).trim()
    const phone = Number(phone_number)

    const existingUser = await db.model('Users').findOne({ telegramId: from.id }).lean()

    if (!existingUser?._id) {
      await sendMessage({
        chat_id: user_id,
        text: TELEGRAM_FALLBACK_TEXT,
        remove_keyboard: true,
        location,
      })
      return true
    }

    await db.model('Users').findByIdAndUpdate(existingUser._id, {
      $set: {
        phone,
        ...(name ? { name } : {}),
      },
    })

    await sendMessage({
      chat_id: user_id,
      text: `${TELEGRAM_FALLBACK_TEXT}\n\nВаш номер телефона обновлен.`,
      remove_keyboard: true,
      location,
    })

    return true
  }
  return false
}

export default checkContactRecive
