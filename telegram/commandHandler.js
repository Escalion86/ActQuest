import LastCommands from '@models/LastCommands'
import dbConnect from '@utils/dbConnect'
import commandsArray from './commands/commandsArray'
import mainMenuButton from './commands/menuItems/mainMenuButton'
import keyboardFormer from './func/keyboardFormer'
import sendMessage from './sendMessage'

function jsonParser(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return
  }
}

const lastCommandHandler = async (telegramId, jsonCommand) => {
  if (commandsArray[jsonCommand.cmd])
    return await commandsArray[jsonCommand.cmd]({ telegramId, jsonCommand })
  return {
    success: false,
    message: 'Неизвестная команда',
    buttons: [mainMenuButton],
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

  const keyboard = keyboardFormer(commandsArray, result.buttons)

  const sendResult = await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text: result.message,
    parse_mode: result.parse_mode,
    keyboard,
    callback_query,
  })
  // console.log('sendResult :>> ', sendResult)
  const nextCommand = result.nextCommand
  if (nextCommand) {
    if (typeof nextCommand === 'string') {
      return await executeCommand(
        userTelegramId,
        { cmd: nextCommand },
        messageId
        // callback_query
      )
    }
    // Если команда содержит в себе command, то значт это готовая команда,
    // если же нет, то значт это дополнение к предыдущей команде
    console.log('nextCommand :>> ', nextCommand)
    const actualCommand = nextCommand.cmd
      ? nextCommand
      : { ...jsonCommand, ...nextCommand }
    delete actualCommand.message

    console.log('actualCommand :>> ', actualCommand)

    return await executeCommand(
      userTelegramId,
      actualCommand,
      messageId
      // callback_query
    )
  } else {
    console.log('!!! jsonCommand :>> ', jsonCommand)
    const actualCommand = { ...jsonCommand }
    delete actualCommand.message
    console.log('!!! actualCommand :>> ', actualCommand)
    await dbConnect()
    return await LastCommands.findOneAndUpdate(
      {
        userTelegramId,
      },
      {
        command: actualCommand,
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
    console.log('message :>> ', message)
    if (message === '/mainMenu' || message === '/start') {
      return await executeCommand(
        userTelegramId,
        { cmd: 'mainMenu' },
        messageId,
        callback_query
      )
    }

    var jsonCommand
    if (message[0] === '/') {
      jsonCommand = { cmd: message.substr(1) }
    } else {
      jsonCommand = jsonParser(message)
      console.log('??? jsonCommand :>> ', jsonCommand)
      // Проверяем есть ли команда, или это дополнение к предыдущей команде
      if (!jsonCommand || !jsonCommand?.cmd) {
        // console.log('Полученная команда не полная или это не команда')
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
        if (!jsonCommand)
          jsonCommand = {
            ...Object.fromEntries(last.command),
            message,
          }
        else
          jsonCommand = {
            ...Object.fromEntries(last.command),
            ...jsonCommand,
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

      await executeCommand(
        userTelegramId,
        lastCommand,
        messageId,
        callback_query
      )
    }
  } catch (e) {
    console.log('e :>> ', e)
  }
}

export default commandHandler
