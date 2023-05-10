import { postData } from '@helpers/CRUD'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import callbackHandler from 'telegram/callbackHandler'
import messageHandler from 'telegram/messageHandler'
import sendMessage from 'telegram/sendMessage'

export default async function handler(req, res) {
  const { query, method, body } = req
  //https://www.xn--80aaennmesfbiiz1a7a.xn--p1ai/api/notifications/telegram/activate
  // await dbConnect()

  if (method === 'GET') {
    try {
      const { update_id, message } = body
      console.log('query :>> ', query)
      await postData(
        `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: '261102161',
          text: `Проверка связи`,
          parse_mode: 'html',
          reply_markup:
            req.headers?.origin?.substr(0, 5) === 'https'
              ? JSON.stringify({
                  inline_keyboard: [
                    [
                      {
                        text: 'Тестовая кнопка1',
                        url: 'https://cigam.ru',
                      },
                      {
                        text: 'Тестовая кнопка2',
                        url: 'https://cigam.ru',
                      },
                    ],
                    [
                      {
                        text: 'Тестовая кнопка3',
                        url: 'https://cigam.ru',
                      },
                      {
                        text: 'Тестовая кнопка4',
                        url: 'https://cigam.ru',
                      },
                      {
                        text: 'Тестовая кнопка5',
                        url: 'https://cigam.ru',
                      },
                    ],
                  ],
                })
              : undefined,
        },
        (data) => console.log('data', data),
        (data) => console.log('error', data),
        true,
        null,
        true
      )

      return res?.status(200).json({ success: true })
    } catch (error) {
      console.log(error)
      return res?.status(400).json({ success: false, error })
    }
  }

  const test_callback = {
    update_id: 173172137,
    callback_query: {
      id: '1121425242543370968',
      from: {
        id: 261102161,
        is_bot: false,
        first_name: 'Алексей',
        last_name: 'Белинский Иллюзионист',
        username: 'Escalion',
        language_code: 'ru',
        is_premium: true,
      },
      message: {
        message_id: 91,
        from: '[Object]',
        chat: ' [Object]',
        date: 1683689196,
        text: 'Неизвестная команда',
        reply_markup: '[Object]',
      },
      chat_instance: '3955131192076482535',
      data: '/create_team',
    },
  }
  const rtest = {
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
  var keyboard = {
    inline_keyboard: [
      // [
      //   { text: 'Yes', url: 'http://www.cigam.ru/' },
      //   { text: 'No', url: 'https://cigam.ru/' },
      // ],
      // [
      //   { text: 'Yes', url: 'http://www.cigam.ru/' },
      //   { text: 'MayBe', url: 'https://cigam.ru/' },
      //   { text: 'No', url: 'https://cigam.ru/' },
      // ],

      [
        {
          text: 'Создать команду',
          callback_data: '/create_team',
        },
      ],
      [
        {
          text: 'Редактировать команду',
          callback_data: '/edit_team',
        },
      ],
      [
        {
          text: 'Присоединиться к команде',
          callback_data: '/join_team',
        },
      ],
    ],
  }
  if (method === 'POST') {
    try {
      // console.log(body)
      if (body?.callback_query) {
        // Принимаем команду
        // console.log('callback_body :>> ', body)
        callbackHandler(body, res)
        // await sendMessage({
        //   chat_id: '261102161',
        //   // text: JSON.stringify({ body, headers: req.headers.origin }),
        //   text: callbackHandler(body, res),
        //   keyboard,
        // })
      } else if (body?.message) {
        // Пользователь написал текст
        // console.log('message_body :>> ', body)
        // const { message_id, from, chat, date, text, entities } = message
        // const {id, from, message, chat_instanse, data}
        messageHandler(body, res)
        // await sendMessage({
        //   chat_id: '261102161',
        //   // text: JSON.stringify({ body, headers: req.headers.origin }),
        //   text: messageHandler(body, res),
        //   keyboard,
        // })
      }
      // console.log('telegram body', body)
      // if (message.text === '/activate' || message.text === '/deactivate') {
      //   console.log('message.text', message.text)
      //   // const users = await Users.find({})
      //   console.log('message.from.id', message.from.id)
      //   const userFromReq = await Users.findOneAndUpdate(
      //     {
      //       'notifications.telegram.userName':
      //         message.from.username.toLowerCase(),
      //     },
      //     {
      //       $set: {
      //         'notifications.telegram.id':
      //           message.text === '/activate' ? message.from.id : null,
      //         // $set: {
      //         //   'telegram.$.id':
      //         //     message.text === '/activate' ? message.from.id : null,
      //         // },
      //       },
      //       // notifications: {
      //       //   telegram: {
      //       //     id: message.text === '/activate' ? message.from.id : null,
      //       //   },
      //       //   // $set: {
      //       //   //   'telegram.$.id':
      //       //   //     message.text === '/activate' ? message.from.id : null,
      //       //   // },
      //       // },
      //       // notifications: {
      //       //   ...userFromReq[0].notifications,
      //       //   telegram: {
      //       //     ...userFromReq[0].notifications.telegram,
      //       //     id: message.text === '/activate' ? message.from.id : null,
      //       //   },
      //       // },
      //     }
      //   )
      //   // console.log('userFromReq', userFromReq)
      //   // const userFromReq = users.find(
      //   //   (user) =>
      //   //     user.notifications?.get('telegram')?.userName &&
      //   //     user.notifications.get('telegram').userName.toLowerCase() ===
      //   //       message.from.username.toLowerCase()
      //   // )
      //   if (userFromReq) {
      //     // const data = await Users.findByIdAndUpdate(userFromReq[0]._id, {
      //     //   notifications: {
      //     //     ...userFromReq[0].notifications,
      //     //     telegram: {
      //     //       ...userFromReq[0].notifications.telegram,
      //     //       id: message.text === '/activate' ? message.from.id : null,
      //     //     },
      //     //   },
      //     // })
      //     return res?.status(200).json({ success: true, data: userFromReq })
      //   }
      //   console.log('Пользователь с таким логином не найден')
      //   return res?.status(200).json({
      //     success: false,
      //     error: 'Пользователь с таким логином не найден',
      //   })
      // }

      return res?.status(200).json({ success: true })
    } catch (error) {
      console.log(error)
      return res?.status(400).json({ success: false, error })
    }
  }
}

// await postData(
//   `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
//   {
//     chat_id: telegramId,
//     text: `Пользователь с номером +${
//       data.phone
//     } заполнил анкету:\n - Полное имя: ${fullUserName}\n - Пол: ${
//       data.gender === 'male' ? 'Мужчина' : 'Женщина'
//     }\n - Дата рождения: ${birthDateToAge(data.birthday, true, true, true)}`,
//     parse_mode: 'html',
//   },
//   (data) => console.log('data', data),
//   (data) => console.log('error', data),
//   true,
//   null,
//   true
// )
// if (data.images && data.images[0]) {
//   await postData(
//     `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMediaGroup`,
//     {
//       chat_id: telegramId,
//       media: JSON.stringify(
//         data.images.map((photo) => {
//           return {
//             type: 'photo',
//             media: photo,
//             // caption: 'Наденька',
//             // "parse_mode": "optional (you can delete this parameter) the parse mode of the caption"
//           }
//         })
//       ),
//       // reply_markup:
//       //   req.headers.origin.substr(0, 5) === 'https'
//       //     ? JSON.stringify({
//       //         inline_keyboard: [
//       //           [
//       //             {
//       //               text: 'Открыть пользователя',
//       //               url: req.headers.origin + '/user/' + eventId,
//       //             },
//       //           ],
//       //         ],
//       //       })
//       //     : undefined,
//     },
//     (data) => console.log('data', data),
//     (data) => console.log('error', data),
//     true,
//     null,
//     true
//   )
//   // await postData(
//   //   `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendPhoto`,
//   //   {
//   //     chat_id: telegramId,
//   //     photo: data.images[0],
//   //     caption: fullUserName,
//   //     // reply_markup:
//   //     //   req.headers.origin.substr(0, 5) === 'https'
//   //     //     ? JSON.stringify({
//   //     //         inline_keyboard: [
//   //     //           [
//   //     //             {
//   //     //               text: 'Открыть пользователя',
//   //     //               url: req.headers.origin + '/user/' + eventId,
//   //     //             },
//   //     //           ],
//   //     //         ],
//   //     //       })
//   //     //     : undefined,
//   //   },
//   //   (data) => console.log('data', data),
//   //   (data) => console.log('error', data),
//   //   true
//   // )
// }