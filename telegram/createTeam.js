import LastCommands from '@models/LastCommands'
import dbConnect from '@utils/dbConnect'
import sendMessage from './sendMessage'

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
    console.log('==> /create_team/set_name')
    await LastCommands.create({
      userTelegramId,
      command: '/create_team/set_name',
    })
    return await sendMessage({
      chat_id: userTelegramId,
      // text: JSON.stringify({ body, headers: req.headers.origin }),
      text: 'Введите название команды',
      keyboard,
    })
    // return res?.status(200).json({ success: true, data })
  } else {
    // Если небыло никаких команд с пользователем
    console.log('lastCommand[0] :>> ', lastCommand[0])
    console.log('object :>> ', String(lastCommand[0].command).split('/'))
    const commandsArray = String(lastCommand[0].command).split('/').shift()
    console.log('commandsArray :>> ', commandsArray)
    if (commandsArray[0] !== 'create_team') {
      console.log('create_team')
      return await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        text: 'Ошибка команды',
      })
    }

    if (commandsArray[1] === 'set_name') {
      console.log('error create_team')
      return await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        text: `Задано название команды: ${command}.\nВведите описание команды (не обязательно)`,
      })
    }

    // return res?.status(200).json({ success: true, data: command })
  }
}

export default createTeam
