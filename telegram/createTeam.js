import LastCommands from '@models/LastCommands'
import dbConnect from '@utils/dbConnect'
import sendMessage from './sendMessage'

const script = async ({ userTelegramId, command, text, keyboard }) => {
  if (command)
    await LastCommands.findOneAndUpdate(
      {
        userTelegramId,
      },
      { command },
      { upsert: true }
    )
  else
    await LastCommands.findOneAndDelete({
      userTelegramId,
    })
  return await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text,
    keyboard,
  })
}

var keyboard = {
  inline_keyboard: [
    [
      {
        text: 'Отмена создания команды',
        callback_data: '/create_team/exit',
      },
    ],
  ],
}

const createTeam = async (userTelegramId, command, res) => {
  await dbConnect()
  const lastCommand = await LastCommands.find({ userTelegramId })
  console.log('userTelegramId :>> ', userTelegramId)
  console.log('lastCommand :>> ', lastCommand)
  if (lastCommand.length === 0) {
    return await async({
      userTelegramId,
      command: '/create_team/set_name',
      text: 'Введите название команды',
      keyboard,
    })
    // console.log('==> /create_team/set_name')
    // await LastCommands.create({
    //   userTelegramId,
    //   command: '/create_team/set_name',
    // })
    // return await sendMessage({
    //   chat_id: userTelegramId,
    //   // text: JSON.stringify({ body, headers: req.headers.origin }),
    //   text: 'Введите название команды',
    //   keyboard,
    // })
    // return res?.status(200).json({ success: true, data })
  } else {
    // Если небыло никаких команд с пользователем
    const commandsArray = String(lastCommand[0].command).split('/')
    commandsArray.shift()
    if (commandsArray[0] !== 'create_team') {
      console.log('create_team')
      return await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        text: 'Ошибка команды',
      })
    }

    if (commandsArray[1] === 'set_name')
      return await script({
        userTelegramId,
        command: '/create_team/set_description',
        text: `Задано название команды: ${command}.\nВведите описание команды (не обязательно)`,
        keyboard,
      })
    if (commandsArray[1] === 'set_description')
      return await script({
        userTelegramId,
        text: `Задано описание команды: ${command}. Создание команды завершено`,
      })

    // return res?.status(200).json({ success: true, data: command })
  }
}

export default createTeam
