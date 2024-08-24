import LastCommands from '@models/LastCommands'
// import dbConnect from '@utils/dbConnect'
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

const commandHandler = async (
  userTelegramId,
  message,
  messageId,
  callback_query,
  photo,
  domen
) => {
  try {
    if (message === '/main_menu' || message === '/start') {
      return await executeCommand(
        userTelegramId,
        { c: 'mainMenu' },
        messageId,
        callback_query,
        domen
      )
    }

    var jsonCommand
    if (message && message[0] === '/') {
      jsonCommand = { c: message.substr(1) }
    } else {
      jsonCommand = jsonParser(message)
      // Проверяем есть ли команда, или это дополнение к предыдущей команде
      if (!jsonCommand || !jsonCommand?.c || jsonCommand?.prevC) {
        // console.log('Полученная команда не полная или это не команда')
        const last = await LastCommands.findOne({
          userTelegramId,
        })

        if (!last) {
          return await sendMessage({
            chat_id: userTelegramId,
            // text: JSON.stringify({ body, headers: req.headers.origin }),
            text: 'Ответ получен, но команда на которую дан ответ не найден',
            domen,
          })
        }
        // Если отправлено сообщение
        if (!jsonCommand) {
          jsonCommand = {
            ...Object.fromEntries(last.command),
            message:
              typeof photo === 'object'
                ? photo[photo.length - 1]?.file_id
                : message,
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
        domen
      )
    } else {
      // Если было отправлено сообщение, то смотрим какая до этого была команда (на что ответ)
      const last = await LastCommands.findOne({
        userTelegramId,
      })

      if (!last) {
        return await sendMessage({
          chat_id: userTelegramId,
          // text: JSON.stringify({ body, headers: req.headers.origin }),
          text: 'Ответ получен, но команда на которую дан ответ не найдена',
          domen,
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
        domen
      )
    }
  } catch (e) {
    console.log('e :>> ', e)
  }
}

export default commandHandler
