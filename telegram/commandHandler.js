import LastCommands from '@models/LastCommands'
import dbConnect from '@utils/dbConnect'
import commandsArray from './commands/commandsArray'
import main_menu_button from './commands/menuItems/main_menu_button'
import keyboardFormer from './func/keyboardFormer'
import sendMessage from './sendMessage'

// const messageToCommandAndProps = (message) => {
//   const commands = message.split('/')
//   commands.shift()

//   const command = commands[0]
//   commands.shift()

//   var props = {}
//   commands.forEach((prop) => {
//     const [key, value] = prop.split('=')
//     props[key] = value === 'null' ? null : value
//   })

//   return { command, props }
// }

function jsonParser(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return
  }
}

const lastCommandHandler = async (telegramId, jsonCommand) => {
  if (commandsArray[jsonCommand.command])
    return await commandsArray[jsonCommand.command]({ telegramId, jsonCommand })
  return {
    success: false,
    message: 'Неизвестная команда',
    buttons: [main_menu_button],
  }
}

const executeCommand = async (
  userTelegramId,
  jsonCommand,
  messageId,
  callback_query
) => {
  // const data = messageToCommandAndProps(command)

  const result = await lastCommandHandler(userTelegramId, jsonCommand)

  console.log('result :>> ', result)

  const keyboard = keyboardFormer(commandsArray, result.buttons)

  const sendResult = await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text: result.message,
    keyboard,
    callback_query,
  })
  // console.log('sendResult :>> ', sendResult)
  const nextCommand = result.nextCommand
  if (nextCommand) {
    console.log('nextCommand :>> ', nextCommand)
    console.log('typeof nextCommand :>> ', typeof nextCommand)
    if (typeof nextCommand === 'string')
      return await executeCommand(
        userTelegramId,
        { command: nextCommand },
        messageId
        // callback_query
      )
    // Если команда содержит в себе command, то значт это готовая команда,
    // если же нет, то значт это дополнение к предыдущей команде
    const actualCommand = nextCommand.command
      ? nextCommand
      : { ...jsonCommand, ...nextCommand }
    return await executeCommand(
      userTelegramId,
      actualCommand,
      messageId
      // callback_query
    )
  } else {
    await dbConnect()
    return await LastCommands.findOneAndUpdate(
      {
        userTelegramId,
      },
      {
        command: jsonCommand,
        messageId,
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
    if (message === '/main_menu' || message === '/start') {
      return await executeCommand(
        userTelegramId,
        { command: 'main_menu' },
        messageId,
        callback_query
      )
    }

    var jsonCommand
    if (message[0] === '/') {
      jsonCommand = { command: message.substr(1) }
    } else {
      jsonCommand = jsonParser(message)
    }

    // Если это был JSON
    if (jsonCommand) {
      // if (data.command[0] === '+') {
      //   await dbConnect()
      //   const last = await LastCommands.findOne({
      //     userTelegramId,
      //   })
      //   const lastCommand = last.command.get('command')
      //   data.command =
      //   message = lastCommand + '/' + message.substr(2)
      // }
      await executeCommand(
        userTelegramId,
        jsonCommand,
        messageId,
        callback_query
      )
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

      const lastCommand = {
        ...Object.fromEntries(last.command),
        message,
      }

      console.log('lastCommand :>> ', lastCommand)

      await executeCommand(
        userTelegramId,
        lastCommand,
        messageId,
        callback_query
      )
    }

    // if (message === '/') message = ''
    // const isItCommand = message[0] === '/'
    // Если была отправлена команда, то ищем ее или возвращаем ошибку
    // if (isItCommand) {
    //   if (message[1] === '+') {
    //     await dbConnect()
    //     const last = await LastCommands.findOne({
    //       userTelegramId,
    //     })
    //     const lastCommand = last.command.get('command')
    //     message = lastCommand + '/' + message.substr(2)
    //   }
    //   await executeCommand(userTelegramId, message, messageId, callback_query)
    // } else {
    //   // Если было отправлено сообщение, то смотрим какая до этого была команда (на что ответ)
    //   await dbConnect()
    //   const last = await LastCommands.findOne({
    //     userTelegramId,
    //   })

    //   if (!last) {
    //     return await sendMessage({
    //       chat_id: userTelegramId,
    //       // text: JSON.stringify({ body, headers: req.headers.origin }),
    //       text: 'Ответ получен, но команда на которую дан ответ не найден',
    //     })
    //   }
    //   const lastCommand = last.command.get('command')

    //   await executeCommand(
    //     userTelegramId,
    //     lastCommand,
    //     messageId,
    //     callback_query,
    //     message
    //   )
    // }
  } catch (e) {
    console.log('e :>> ', e)
  }
}

export default commandHandler
