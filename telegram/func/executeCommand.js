import commandsArray, {
  commandToNum,
  numToCommand,
} from 'telegram/commands/commandsArray'
import mainMenuButton from 'telegram/commands/menuItems/mainMenuButton'
import sendMessage from 'telegram/sendMessage'
import keyboardFormer from './keyboardFormer'

const lastCommandHandler = async (
  telegramId,
  jsonCommand,
  location,
  user,
  db,
  lastCommand
) => {
  let actualJsonCommand = { ...jsonCommand }

  if (typeof jsonCommand.c === 'number') {
    if (
      !jsonCommand.page &&
      lastCommand?.pages &&
      lastCommand.pages[jsonCommand.c]
    ) {
      actualJsonCommand.page = lastCommand.pages[jsonCommand.c]
    }

    return await commandsArray[numToCommand[jsonCommand.c]]({
      telegramId,
      jsonCommand: actualJsonCommand,
      location,
      user,
      db,
      lastCommand,
    })
  }

  if (commandsArray[jsonCommand.c]) {
    if (!jsonCommand.page && lastCommand?.pages) {
      const commandNum = commandToNum(jsonCommand.c)
      if (lastCommand.pages[commandNum])
        actualJsonCommand.page = lastCommand.pages[commandNum]
    }

    return await commandsArray[jsonCommand.c]({
      telegramId,
      jsonCommand: actualJsonCommand,
      location,
      user,
      db,
      lastCommand,
    })
  }

  return {
    success: false,
    message: 'Неизвестная команда',
    buttons: [mainMenuButton],
  }
}

const executeCommand = async ({
  userTelegramId,
  jsonCommand,
  messageId,
  callback_query,
  location,
  user,
  db,
  lastCommand,
}) => {
  console.log('lastCommand :>> ', lastCommand)
  const result = await lastCommandHandler(
    userTelegramId,
    jsonCommand,
    location,
    user,
    db,
    lastCommand
  )
  console.log('result :>> ', result)
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
      console.log('nextCommand :>> ', nextCommand)
      return await executeCommand({
        userTelegramId,
        jsonCommand: { c: nextCommand },
        messageId,
        callback_query,
        // undefined, // callback_query,
        location,
        user,
        db,
        lastCommand,
      })
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

    return await executeCommand({
      userTelegramId,
      jsonCommand: actualCommand,
      messageId,
      callback_query,
      location,
      user,
      db,
      lastCommand,
    })
  } else {
    const actualCommand = { ...jsonCommand }
    delete actualCommand.message
    delete actualCommand.isPhoto
    delete actualCommand.isVideo
    delete actualCommand.isDocument

    return await db.model('LastCommands').findOneAndUpdate(
      {
        userTelegramId,
      },
      {
        command: actualCommand,
        prevCommand: lastCommand?.command,
        messageId,
        pages:
          actualCommand?.c && actualCommand?.page
            ? { ...lastCommand?.pages, [actualCommand.c]: actualCommand.page }
            : lastCommand?.pages,
      },
      { upsert: true }
    )
  }
}

export default executeCommand
