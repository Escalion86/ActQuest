// import Users from '@models/Users'

import sendMessage from './sendMessage'
import { TELEGRAM_FALLBACK_TEXT } from './constants'
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
  locationDb,
  db
) => {
  await sendMessage({
    chat_id: from.id,
    text: TELEGRAM_FALLBACK_TEXT,
    remove_keyboard: true,
    location: locationDb,
  })
}

export default locationHandler
