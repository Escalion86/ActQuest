import commandsArray, {
  commandToNum,
  numToCommand,
} from 'telegram/commands/commandsArray'
import mainMenuButton from 'telegram/commands/menuItems/mainMenuButton'
// import sendMessage from 'telegram/sendMessage'
import dbConnect from '@utils/dbConnect'
import keyboardFormer from 'telegram/func/keyboardFormer'

const lastCommandHandler = async (
  telegramId,
  jsonCommand,
  location,
  user,
  db,
  lastCommand
) => {
  let actualJsonCommand = { ...jsonCommand }
  console.log('jsonCommand :>> ', jsonCommand)
  console.log('lastCommand :>> ', lastCommand)

  if (typeof jsonCommand.c === 'number') {
    if (lastCommand?.pages && lastCommand.pages[jsonCommand.c]) {
      actualJsonCommand.page = lastCommand.pages[jsonCommand.c]
    }
    console.log('actualJsonCommand :>> ', actualJsonCommand)

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
    if (lastCommand?.pages) {
      const commandNum = commandToNum(jsonCommand.c)
      if (lastCommand.pages[commandNum])
        actualJsonCommand.page = lastCommand.pages[commandNum]
    }
    console.log('actualJsonCommand :>> ', actualJsonCommand)

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
  // messageId,
  // callback_query,
  location,
  user,
  db,
  lastCommand,
}) => {
  let actualDb = db
  if (!db) actualDb = await dbConnect(location)

  const result = await lastCommandHandler(
    userTelegramId,
    jsonCommand,
    location,
    user,
    actualDb,
    lastCommand
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
  console.log('nextCommand :>> ', nextCommand)
  if (nextCommand) {
    if (typeof nextCommand === 'string') {
      return await executeCommand({
        userTelegramId,
        jsonCommand: { c: nextCommand },
        // messageId,
        // callback_query,
        location,
        user,
        db: actualDb,
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
      location,
      user,
      db: actualDb,
      lastCommand,
    })
  } else {
    const actualCommand = { ...jsonCommand }
    // console.log('actualCommand :>> ', actualCommand)
    delete actualCommand.message
    delete actualCommand.isPhoto
    delete actualCommand.isVideo
    delete actualCommand.isDocument
    const prevCommand = await actualDb.model('LastCommands').findOne({
      userTelegramId,
    })
    // console.log('prevCommand :>> ', prevCommand)
    await actualDb.model('LastCommands').findOneAndUpdate(
      {
        userTelegramId,
      },
      {
        command: actualCommand,
        prevCommand: prevCommand?.command,
        // messageId,
      },
      { upsert: true }
    )
  }

  return sendResult
}

export default executeCommand
