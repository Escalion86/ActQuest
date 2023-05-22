import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import checkUserData from './checkUserData'
import commandHandler from './commandHandler'
import sendMessage from './sendMessage'

const test_message = {
  body: {
    update_id: 173172081,
    message: {
      message_id: 14,
      from: {
        id: 261102161,
        is_bot: false,
        first_name: 'Алексей',
        last_name: 'Белинский Иллюзионист',
        username: 'Escalion',
        language_code: 'ru',
        is_premium: true,
      },
      chat: {
        id: 261102161,
        first_name: 'Алексей',
        last_name: 'Белинский Иллюзионист',
        username: 'Escalion',
        type: 'private',
      },
      date: 1683645745,
      text: '/new_team',
      entities: [{ offset: 0, length: 12, type: 'bot_command' }],
    },
  },
}

const messageHandler = async (body, res) => {
  const { update_id, message } = body
  const {
    message_id,
    from,
    chat,
    date,
    text,
    entities,
    contact,
    reply_to_message,
  } = message
  await dbConnect()

  if (contact) {
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

    return await sendMessage({
      chat_id: user_id,
      text: `Регистрация успешна! Ваши данные:\n - Имя: ${name}\n - Телефон: ${phone_number}`,
      keyboard: {
        inline_keyboard: [
          [{ text: 'Изменить имя', callback_data: `/set_user_name` }],
          [{ text: '\u{1F3E0} Главное меню', callback_data: `/main_menu` }],
        ],
        hide_keyboard: true,
      },
    })
    // return await commandHandler(from.id, '/main_menu', res)
  }

  if (await checkUserData(from.id))
    return await commandHandler(from.id, text, message.message_id)
}

export default messageHandler
