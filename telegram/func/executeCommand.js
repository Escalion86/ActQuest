import commandsArray, { numToCommand } from 'telegram/commands/commandsArray'
import mainMenuButton from 'telegram/commands/menuItems/mainMenuButton'
import sendMessage from 'telegram/sendMessage'
import keyboardFormer from './keyboardFormer'

const lastCommandHandler = async (telegramId, jsonCommand, location, user) => {
  if (typeof jsonCommand.c === 'number') {
    return await commandsArray[numToCommand[jsonCommand.c]]({
      telegramId,
      jsonCommand,
      location,
      user,
    })
  }
  if (commandsArray[jsonCommand.c])
    return await commandsArray[jsonCommand.c]({
      telegramId,
      jsonCommand,
      location,
      user,
    })
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
  callback_query,
  location,
  user,
  db
) => {
  const result = await lastCommandHandler(
    userTelegramId,
    jsonCommand,
    location,
    user
  )
  const keyboard = keyboardFormer(result.buttons)

  if (result.images) {
    const imagesArrays = []
    for (let i = 0; i < result.images.length; i += 10) {
      imagesArrays.push(result.images.slice(i, i + 10))
    }

    for (let i = 0; i < imagesArrays.length; i++) {
      await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        // text: result.message,
        parse_mode: result.parse_mode,
        // keyboard,
        callback_query,
        images: imagesArrays[i],
        location,
      })
    }
  }

  const sendResult = await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text: result.message,
    parse_mode: result.parse_mode,
    keyboard,
    callback_query: result.images ? undefined : callback_query,
    location,
  })

  const nextCommand = result.nextCommand
  if (nextCommand) {
    if (typeof nextCommand === 'string') {
      return await executeCommand(
        userTelegramId,
        { c: nextCommand },
        messageId,
        undefined, // callback_query,
        location,
        user,
        db
      )
    }
    // Если команда содержит в себе command, то значт это готовая команда,
    // если же нет, то значт это дополнение к предыдущей команде
    const actualCommand = nextCommand.c
      ? nextCommand
      : { ...jsonCommand, ...nextCommand }
    delete actualCommand.message
    delete actualCommand.isPhoto
    delete actualCommand.isVideo
    delete actualCommand.isDocument

    return await executeCommand(
      userTelegramId,
      actualCommand,
      messageId,
      undefined, // callback_query
      location,
      user,
      db
    )
  } else {
    const actualCommand = { ...jsonCommand }
    delete actualCommand.message
    delete actualCommand.isPhoto
    delete actualCommand.isVideo
    delete actualCommand.isDocument
    const prevCommand = await db.model('LastCommands').findOne({
      userTelegramId,
    })
    return await db.model('LastCommands').findOneAndUpdate(
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
