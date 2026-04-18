import commandsArray, {
  commandToNum,
  numToCommand,
} from 'telegram/commands/commandsArray'
import mainMenuButton from 'telegram/commands/menuItems/mainMenuButton'
// import sendMessage from 'telegram/sendMessage'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import keyboardFormer from 'telegram/func/keyboardFormer'

const lastCommandHandler = async (
  telegramId,
  userId,
  jsonCommand,
  location,
  user,
  db,
  lastCommand,
  source
) => {
  let actualJsonCommand = { ...jsonCommand }
  const buildCommandArgs = (customJsonCommand = actualJsonCommand) => ({
    telegramId,
    userId,
    jsonCommand: customJsonCommand,
    location,
    user,
    db,
    lastCommand,
    source,
  })

  if (typeof jsonCommand.c === 'number') {
    if (
      !jsonCommand.page &&
      lastCommand?.pages &&
      lastCommand.pages[jsonCommand.c]
    ) {
      actualJsonCommand.page = lastCommand.pages[jsonCommand.c]
    }

    return await commandsArray[numToCommand[jsonCommand.c]](buildCommandArgs())
  }

  if (commandsArray[jsonCommand.c]) {
    if (!jsonCommand.page && lastCommand?.pages) {
      const commandNum = commandToNum[jsonCommand.c]
      if (lastCommand.pages[commandNum])
        actualJsonCommand.page = lastCommand.pages[commandNum]
    }

    return await commandsArray[jsonCommand.c](buildCommandArgs())
  }

  return {
    success: false,
    message: 'Неизвестная команда',
    buttons: [mainMenuButton],
  }
}

const executeCommand = async ({
  userTelegramId,
  userId,
  jsonCommand,
  // messageId,
  // callback_query,
  location,
  user,
  db,
  lastCommand,
  source = 'web',
}) => {
  let actualDb = db
  if (!db) actualDb = await dbConnectGlobal()

  const result = await lastCommandHandler(
    userTelegramId,
    userId,
    jsonCommand,
    location,
    user,
    actualDb,
    lastCommand,
    source
  )
  const keyboard = keyboardFormer(result.buttons)

  // if (result.images) {
  //   const imagesArrays = []
  //   for (let i = 0; i < result.images.length; i += 10) {
  //     imagesArrays.push(result.images.slice(i, i + 10))
  //   }

  //   for (let i = 0; i < imagesArrays.length; i++) {
  //     await sendMessage({
  //       chat_id: userTelegramId,
  //       // text: JSON.stringify({ body, headers: req.headers.origin }),
  //       // text: result.message,
  //       parse_mode: result.parse_mode,
  //       // keyboard,
  //       callback_query,
  //       images: imagesArrays[i],
  //       location,
  //     })
  //   }
  // }

  // const sendResult = await sendMessage({
  //   chat_id: userTelegramId,
  //   // text: JSON.stringify({ body, headers: req.headers.origin }),
  //   text: result.message,
  //   parse_mode: result.parse_mode,
  //   keyboard,
  //   callback_query: result.images ? undefined : callback_query,
  //   location,
  // })

  const sendResult = {
    text: result.message,
    keyboard,
  }

  const nextCommand = result.nextCommand
  if (nextCommand) {
    if (typeof nextCommand === 'string') {
      return await executeCommand({
        userTelegramId,
        userId,
        jsonCommand: { c: nextCommand },
        // messageId,
        // callback_query,
        location,
        user,
        db: actualDb,
        lastCommand,
        source,
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
      userId,
      jsonCommand: actualCommand,
      location,
      user,
      db: actualDb,
      lastCommand,
      source,
    })
  } else {
    const actualCommand = { ...jsonCommand }
    // console.log('actualCommand :>> ', actualCommand)
    delete actualCommand.message
    delete actualCommand.isPhoto
    delete actualCommand.isVideo
    delete actualCommand.isDocument
    const normalizedTelegramId = Number(userTelegramId)
    if (Number.isFinite(normalizedTelegramId)) {
      const prevCommand = await actualDb.model('LastCommands').findOne({
        userTelegramId: normalizedTelegramId,
      })
      // console.log('prevCommand :>> ', prevCommand)
      await actualDb.model('LastCommands').findOneAndUpdate(
        {
          userTelegramId: normalizedTelegramId,
        },
        {
          command: actualCommand,
          prevCommand: prevCommand?.command,
          // messageId,
        },
        { upsert: true }
      )
    }
  }

  return sendResult
}

export default executeCommand
