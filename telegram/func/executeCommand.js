import LastCommands from '@models/LastCommands'
import dbConnect from '@utils/dbConnect'
import commandsArray, { numToCommand } from 'telegram/commands/commandsArray'
import mainMenuButton from 'telegram/commands/menuItems/mainMenuButton'
import sendMessage from 'telegram/sendMessage'
import keyboardFormer from './keyboardFormer'

const lastCommandHandler = async (telegramId, jsonCommand) => {
  if (typeof jsonCommand.c === 'number') {
    return await commandsArray[numToCommand[jsonCommand.c]]({
      telegramId,
      jsonCommand,
    })
  }
  if (commandsArray[jsonCommand.c])
    return await commandsArray[jsonCommand.c]({ telegramId, jsonCommand })
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
  console.log('executeCommand => jsonCommand :>> ', jsonCommand)
  const result = await lastCommandHandler(userTelegramId, jsonCommand)
  const keyboard = keyboardFormer(result.buttons)

  if (result.images) {
    console.log('executeCommand 1')
    await sendMessage({
      chat_id: userTelegramId,
      // text: JSON.stringify({ body, headers: req.headers.origin }),
      // text: result.message,
      parse_mode: result.parse_mode,
      // keyboard,
      // callback_query,
      images: result.images,
    })
  }

  // console.log('executeCommand => result :>> ', result)

  const messageToSend = {
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text: result.message,
    parse_mode: result.parse_mode,
    keyboard,
    callback_query: result.images ? undefined : callback_query,
  }
  // console.log('messageToSend :>> ', messageToSend)

  const sendResult = await sendMessage(messageToSend)
  // console.log('sendResult :>> ', sendResult)
  const nextCommand = result.nextCommand
  if (nextCommand) {
    if (typeof nextCommand === 'string') {
      return await executeCommand(
        userTelegramId,
        { c: nextCommand },
        messageId
        // callback_query
      )
    }
    // Если команда содержит в себе command, то значт это готовая команда,
    // если же нет, то значт это дополнение к предыдущей команде
    const actualCommand = nextCommand.c
      ? nextCommand
      : { ...jsonCommand, ...nextCommand }
    delete actualCommand.message

    return await executeCommand(
      userTelegramId,
      actualCommand,
      messageId
      // callback_query
    )
  } else {
    const actualCommand = { ...jsonCommand }
    delete actualCommand.message
    await dbConnect()
    const prevCommand = await LastCommands.findOne({
      userTelegramId,
    })
    return await LastCommands.findOneAndUpdate(
      {
        userTelegramId,
      },
      {
        command: actualCommand,
        prevCommand: prevCommand?.command,
        messageId,
      },
      { upsert: true }
    )
  }
}

export default executeCommand
