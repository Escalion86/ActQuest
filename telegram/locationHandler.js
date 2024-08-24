// import Users from '@models/Users'
// import dbConnect from '@utils/dbConnect'
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
  domen
) => {
  if (await checkUserData(from.id, undefined, domen))
    return await commandHandler(
      from.id,
      undefined,
      message_id,
      undefined,
      undefined,
      domen,
      location,
      edit_date ? Date(edit_date) : date ? Date(date) : undefined
    )
}

export default locationHandler
