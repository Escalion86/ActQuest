import LastCommands from '@models/LastCommands'
import dbConnect from '@utils/dbConnect'
import commandsArray from './commands/commandsArray'
import keyboardFormer from './func/keyboardFormer'
import sendMessage from './sendMessage'

const messageToCommandAndProps = (message) => {
  const commands = message.split('/')
  commands.shift()

  const command = commands[0]
  commands.shift()

  var props = {}
  commands.forEach((prop) => {
    const [key, value] = prop.split('=')
    props[key] = value
  })

  return { command, props }
}

const lastCommandHandler = async (telegramId, command, props, message) => {
  if (commandsArray[command])
    return await commandsArray[command]({ telegramId, props, message })
  return { success: false, message: 'Неизвестная команда' }
}

const executeCommand = async (
  userTelegramId,
  command,
  messageId,
  callback_query,
  message
) => {
  const data = messageToCommandAndProps(command)

  const result = await lastCommandHandler(
    userTelegramId,
    data.command,
    data.props,
    message
  )
  const keyboard = keyboardFormer(commandsArray, result.buttons)

  const sendResult = await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text: result.message,
    keyboard,
    callback_query,
  })
  // console.log('sendResult :>> ', sendResult)

  if (result.nextCommand)
    return await executeCommand(
      userTelegramId,
      result.nextCommand,
      messageId
      // callback_query
    )
  else {
    await dbConnect()
    return await LastCommands.findOneAndUpdate(
      {
        userTelegramId,
      },
      {
        command: {
          command,
          messageId,
          // props: { teamName: message },
        },
      },
      { upsert: true }
    )
  }
}

const commandHandler = async (
  userTelegramId,
  message,
  messageId,
  callback_query
) => {
  try {
    if (message === '/') message = ''
    const isItCommand = message[0] === '/'
    // Если была отправлена команда, то ищем ее или возвращаем ошибку
    if (isItCommand) {
      if (message[1] === '+') {
        await dbConnect()
        const last = await LastCommands.findOne({
          userTelegramId,
        })
        const lastCommand = last.command.get('command')
        message = lastCommand + '/' + message.substr(2)
      }
      await executeCommand(userTelegramId, message, messageId, callback_query)
    } else {
      // Если было отправлено сообщение, то смотрим какая до этого была команда (на что ответ)
      await dbConnect()
      const last = await LastCommands.findOne({
        userTelegramId,
      })

      if (!last) {
        return await sendMessage({
          chat_id: userTelegramId,
          // text: JSON.stringify({ body, headers: req.headers.origin }),
          text: 'Ответ получен, но команда на которую дан ответ не найден',
        })
      }
      const lastCommand = last.command.get('command')

      await executeCommand(
        userTelegramId,
        lastCommand,
        messageId,
        callback_query,
        message
      )

      // const { command, props } = messageToCommandAndProps(lastCommand)

      // const result = await lastCommandHandler(
      //   userTelegramId,
      //   command,
      //   props,
      //   message
      // )
      // const keyboard = keyboardFormer(commandsArray, result.buttons)
      // await sendMessage({
      //   chat_id: userTelegramId,
      //   // text: JSON.stringify({ body, headers: req.headers.origin }),
      //   text: result.message,
      //   keyboard,
      // })

      // if (result.nextCommand) {
      //   return await executeCommand(
      //     userTelegramId,
      //     result.nextCommand,
      //     messageId
      //     // callback_query
      //   )
      // }
    }
  } catch (e) {
    console.log('e :>> ', e)
  }
}

export default commandHandler
