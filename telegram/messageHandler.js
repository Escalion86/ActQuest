// import Users from '@models/Users'

import checkContactRecive from './checkContactRecive'
import checkUserData from './checkUserData'
import commandHandler from './commandHandler'
// import sendMessage from './sendMessage'

// const test_message = {
//   body: {
//     update_id: 173172081,
//     message: {
//       message_id: 14,
//       from: {
//         id: 261102161,
//         is_bot: false,
//         first_name: 'Алексей',
//         last_name: 'Белинский Иллюзионист',
//         username: 'Escalion',
//         language_code: 'ru',
//         is_premium: true,
//       },
//       chat: {
//         id: 261102161,
//         first_name: 'Алексей',
//         last_name: 'Белинский Иллюзионист',
//         username: 'Escalion',
//         type: 'private',
//       },
//       date: 1683645745,
//       text: '/new_team',
//       entities: [{ offset: 0, length: 12, type: 'bot_command' }],
//     },
//   },
// }

const messageHandler = async (body, location, db) => {
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
    document,
    photo, // Если было отправлено фото
    video, // Если было отправлено видео
  } = message

  if (await checkContactRecive(body?.message, location, db)) {
    const user = await checkUserData(from.id, undefined, location, db)
    if (user)
      return await commandHandler(
        {
          userTelegramId: from.id,
          message: text,
          messageId: message_id,
          // callback_query,
          photo,
          location,
          // location,
          // date,
          user,
          video,
          document,
          db,
        }
        // from.id,
        // text,
        // message_id,
        // undefined,
        // photo,
        // location,
        // undefined,
        // undefined,
        // user
      )
  }
}

export default messageHandler
