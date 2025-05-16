import checkContactRecive from './checkContactRecive'
import checkUserData from './checkUserData'
import commandHandler from './commandHandler'

// const test_callback = {
//   update_id: 173172137,
//   callback_query: {
//     id: '1121425242543370968',
//     from: {
//       id: 261102161,
//       is_bot: false,
//       first_name: 'Алексей',
//       last_name: 'Белинский Иллюзионист',
//       username: 'Escalion',
//       language_code: 'ru',
//       is_premium: true,
//     },
//     message: {
//       message_id: 91,
//       from: '[Object]',
//       chat: ' [Object]',
//       date: 1683689196,
//       text: 'Неизвестная команда',
//       reply_markup: '[Object]',
//     },
//     chat_instance: '3955131192076482535',
//     data: '/createTeam',
//   },
// }

const callbackHandler = async (body, location, db) => {
  const { callback_query } = body
  const { id, from, message, data, chat_instance } = callback_query
  // console.log('callback_query :>> ', callback_query)
  // await postData(
  //   `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/answerCallbackQuery`,
  //   {
  //     callback_query_id: id,
  //   },
  //   null,
  //   null,
  //   // (data) => console.log('post success', data),
  //   // (data) => console.log('post error', data),
  //   true,
  //   null,
  //   true
  // )
  // console.log('message.message_id :>> ', message.message_id)
  // await postData(
  //   `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageReplyMarkup`,
  //   {
  //     message_id: message.message_id,
  //     chat_id: from.id,
  //     reply_markup: { inline_keyboard: [] },
  //   },
  //   null,
  //   null,
  //   // (data) => console.log('post success', data),
  //   // (data) => console.log('post error', data),
  //   true,
  //   null,
  //   true
  // )
  // await postData(
  //   `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage`,
  //   {
  //     message_id: message.message_id,
  //     chat_id: from.id,
  //   },
  //   null,
  //   null,
  //   // (data) => console.log('post success', data),
  //   // (data) => console.log('post error', data),
  //   true,
  //   null,
  //   true
  // )
  if (await checkContactRecive(body?.message, location, db)) {
    const user = await checkUserData(from.id, undefined, location, db)
    if (user)
      return await commandHandler(
        {
          userTelegramId: from.id,
          message: data,
          messageId: message.message_id,
          callback_query,
          // photo,
          location,
          // location,
          // date,
          user,
          db,
        }
        // from.id,
        // data,
        // message.message_id,
        // callback_query,
        // undefined,
        // location,
        // undefined,
        // undefined,
        // user
      )
  }
}

export default callbackHandler
