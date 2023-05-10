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
  // Если небыло никаких команд с пользователем
  if (!lastCommand) {
    await LastCommands.create({
      userTelegramId,
      command: '/create_team/set_name',
    })
    await sendMessage({
      chat_id: '261102161',
      // text: JSON.stringify({ body, headers: req.headers.origin }),
      text: 'Введите название команды',
      keyboard,
    })
    res?.status(200).json({ success: true, data })
  }
}

export default createTeam
