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
  // console.log('message body :>> ', body)
  if (contact) {
    const { phone_number, first_name, last_name, user_id } = contact
    console.log('contact :>> ', contact)
    return await sendMessage({
      chat_id: user_id,
      // text: JSON.stringify({ body, headers: req.headers.origin }),
      text: 'Данные получены!',
      // props: { request_contact: true },
      // keyboard: {
      //   keyboard: [
      //     [{ text: 'Отправить номер телефона', request_contact: true }],
      //   ],
      //   resize_keyboard: true,
      //   one_time_keyboard: true,
      // },
    })
  }
  // switch (text) {
  //   case '/create_team':
  //     // return 'Создание команды'
  return await commandHandler(from.id, text, res)
  //   case '/edit_team':
  //     return 'Редактирование команды'
  //   case '/join_team':
  //     return 'Присоединиться к команде'
  //   default:
  //     return 'Неизвестная команда'
  // }
}

export default messageHandler
