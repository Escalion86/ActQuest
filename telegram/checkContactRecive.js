import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import sendMessage from './sendMessage'

const checkContactRecive = async (body) => {
  // Проверяем не отправлен ли нам контакт
  const contact = body?.message?.contact
  if (contact) {
    await dbConnect()
    const { phone_number, first_name, last_name, user_id } = contact
    const name = (first_name + (last_name ? ' ' + last_name : '')).trim()
    const user = await Users.findOneAndUpdate(
      {
        telegramId: from.id,
      },
      {
        name,
        phone: Number(phone_number),
      },
      { upsert: true }
    )

    await sendMessage({
      chat_id: user_id,
      text: `Регистрация успешна! Ваши данные:\n - Имя: ${name}\n - Телефон: ${phone_number}`,
      keyboard: {
        inline_keyboard: [
          [{ text: 'Изменить имя', callback_data: `/setUserName` }],
          [{ text: '\u{1F3E0} Главное меню', callback_data: `/mainMenu` }],
        ],
        hide_keyboard: true,
      },
    })
    return false
  }
  return true
}

export default checkContactRecive
