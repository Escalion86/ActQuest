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

const executeCommand = async (userTelegramId, message, messageId) => {
  const { command, props } = messageToCommandAndProps(message)

  const result = await lastCommandHandler(userTelegramId, command, props)
  const keyboard = keyboardFormer(commandsArray, result.buttons)

  await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text: result.message,
    keyboard,
  })

  if (result.nextCommand)
    return await executeCommand(userTelegramId, result.nextCommand, messageId)
  else {
    await dbConnect()
    return await LastCommands.findOneAndUpdate(
      {
        userTelegramId,
      },
      {
        command: {
          command: message,
          messageId,
          // props: { teamName: message },
        },
      },
      { upsert: true }
    )
  }

  return
}

const commandHandler = async (userTelegramId, message, messageId) => {
  try {
    await dbConnect()
    if (message === '/') message = ''

    const isItCommand = message[0] === '/'
    // Если была отправлена команда, то ищем ее или возвращаем ошибку
    if (isItCommand) {
      if (message[1] === '+') {
        const last = await LastCommands.findOne({
          userTelegramId,
        })
        const lastCommand = last.command.get('command')
        message = lastCommand + '/' + message.substr(2)
      }
      await executeCommand(userTelegramId, message, messageId)
    } else {
      // Если было отправлено сообщение, то смотрим какая до этого была команда (на что ответ)
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
      console.log('lastCommand :>> ', lastCommand)
      const { command, props } = messageToCommandAndProps(lastCommand)

      const result = await lastCommandHandler(
        userTelegramId,
        command,
        props,
        message
      )
      await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        text: result.message,
        // keyboard,
      })

      if (result.nextCommand) {
        return await executeCommand(
          userTelegramId,
          result.nextCommand,
          messageId
        )
      }
    }
  } catch (e) {
    console.log('e :>> ', e)
  }
}

export default commandHandler
