// import Users from '@models/Users'

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

const locationHandler = async (
  { message_id, from, chat, date, edit_date, location },
  res,
  locationDb,
  db
) => {
  const user = await checkUserData(from.id, undefined, locationDb, db)
  if (user)
    return await commandHandler(
      {
        userTelegramId: from.id,
        // message,
        messageId: message_id,
        // callback_query,
        // photo,
        userLocation: location,
        location: locationDb,
        date: edit_date ? edit_date : date,
        user,
        db,
      }
      // from.id,
      // undefined,
      // message_id,
      // undefined,
      // undefined,
      // location,
      // location,
      // edit_date ? edit_date : date,
      // user
    )
}

export default locationHandler
