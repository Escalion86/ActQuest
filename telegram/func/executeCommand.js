import LastCommands from '@models/LastCommands'
import dbConnect from '@utils/dbConnect'
import commandsArray from 'telegram/commands/commandsArray'
import mainMenuButton from 'telegram/commands/menuItems/mainMenuButton'
import sendMessage from 'telegram/sendMessage'
import keyboardFormer from './keyboardFormer'

const lastCommandHandler = async (telegramId, jsonCommand) => {
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

  const result = await lastCommandHandler(userTelegramId, jsonCommand)
  // console.log('result :>> ', result)

  const keyboard = keyboardFormer(commandsArray, result.buttons)
  // console.log('keyboard ', keyboard?.inline_keyboard)

  // if (result.images) {
  //   await sendMessage({
  //     chat_id: userTelegramId,
  //     // text: JSON.stringify({ body, headers: req.headers.origin }),
  //     // text: result.message,
  //     parse_mode: result.parse_mode,
  //     // keyboard,
  //     // callback_query,
  //     images: result.images,
  //   })
  // }

  const sendResult = await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text: result.message,
    parse_mode: result.parse_mode,
    keyboard,
    callback_query: result.images ? undefined : callback_query,
  })
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
        prevCommand: prevCommand.command,
        messageId,
      },
      { upsert: true }
    )
  }
}

export default executeCommand
