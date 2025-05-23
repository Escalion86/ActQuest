import executeCommand from './func/executeCommand'
import sendMessage from './sendMessage'

function jsonParser(str) {
  try {
    if (!str) return
    const json = JSON.parse(str)
    if (typeof json === 'object') return json
    return
  } catch (e) {
    return
  }
}

const commandHandler = async ({
  userTelegramId,
  message,
  messageId,
  callback_query,
  photo,
  video,
  document,
  userLocation,
  location,
  date,
  user,
  db,
}) => {
  try {
    // Если пользователь прислал геопозицию
    if (userLocation) {
      await db.model('Users').findOneAndUpdate(
        {
          telegramId: userTelegramId,
        },
        {
          location: { ...userLocation, date: date ? Date(date) : Date() },
        }
      )
      return
    }

    if (message === '/main_menu' || message === '/start') {
      console.log('message :>> ', message)
      return await executeCommand(
        userTelegramId,
        { c: 'mainMenu' },
        messageId,
        callback_query,
        location,
        user,
        db
      )
    }

    // if (message === '/test') {
    //   return await sendMessage({
    //     chat_id: userTelegramId,
    //     // text: JSON.stringify({ body, headers: req.headers.origin }),
    //     text: 'Test',
    //     location,
    //     keyboard: {
    //       keyboard: [
    //         [
    //           {
    //             text: 'Я КНОПКА - НАЖМИ МЕНЯ!, чтобы отправить данные о местоположении',
    //             request_location: true,
    //           },
    //         ],
    //       ],
    //       // resize_keyboard: true,
    //       one_time_keyboard: true,
    //     },
    //   })
    // }

    if (message === '/testoff') {
      return await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        text: 'Test',
        location,
        remove_keyboard: true,
      })
    }

    var jsonCommand
    if (message && message[0] === '/') {
      jsonCommand = { c: message.substr(1) }
    } else {
      jsonCommand = jsonParser(message)
      // Проверяем есть ли команда, или это дополнение к предыдущей команде
      if (!jsonCommand || !jsonCommand?.c || jsonCommand?.prevC) {
        // console.log('Полученная команда не полная или это не команда')
        const last = await db.model('LastCommands').findOne({
          userTelegramId,
        })

        if (!last) {
          return await sendMessage({
            chat_id: userTelegramId,
            // text: JSON.stringify({ body, headers: req.headers.origin }),
            text: 'Ответ получен, но команда на которую дан ответ не найден',
            location,
          })
        }
        // console.log('photo :>> ', photo)
        // console.log('video :>> ', video)
        // console.log('document :>> ', document)

        const isPhoto = Boolean(
          typeof photo === 'object' && photo[photo.length - 1]?.file_id
        )
        const isVideo = Boolean(typeof video === 'object' && video?.file_id)
        const isDocument = Boolean(
          typeof document === 'object' && document?.file_id
        )
        // Если отправлено сообщение
        if (!jsonCommand) {
          jsonCommand = {
            ...Object.fromEntries(last.command),
            message: isPhoto
              ? photo[photo.length - 1]?.file_id
              : isVideo
              ? video?.file_id
              : isDocument
              ? document?.file_id
              : message,
            isPhoto,
            isVideo,
            isDocument,
          }
        } else {
          if (jsonCommand?.prevC && last?.prevCommand) {
            // console.log('last?.prevCommand :>> ', last?.prevCommand)
            delete jsonCommand.prevC
            jsonCommand = {
              ...Object.fromEntries(last.prevCommand),
              ...jsonCommand,
            }
          } else {
            jsonCommand = {
              ...Object.fromEntries(last.command),
              ...jsonCommand,
            }
          }
        }
        // console.log('Итоговая команда :>> ', jsonCommand)
      }
    }

    // Если это был JSON
    if (jsonCommand) {
      await executeCommand(
        userTelegramId,
        jsonCommand,
        messageId,
        callback_query,
        location,
        user,
        db
      )
    } else {
      // Если было отправлено сообщение, то смотрим какая до этого была команда (на что ответ)
      const last = await db.model('LastCommands').findOne({
        userTelegramId,
      })

      if (!last) {
        return await sendMessage({
          chat_id: userTelegramId,
          // text: JSON.stringify({ body, headers: req.headers.origin }),
          text: 'Ответ получен, но команда на которую дан ответ не найдена',
          location,
        })
      }

      const lastCommand = {
        ...Object.fromEntries(last.command),
        message,
      }

      await executeCommand(
        userTelegramId,
        lastCommand,
        messageId,
        callback_query,
        location,
        user,
        db
      )
    }
  } catch (e) {
    console.log('e :>> ', e)
  }
}

export default commandHandler
