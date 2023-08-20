import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

const setUserName = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand.message)
    return {
      success: true,
      message: 'Введите имя',
      buttons: [{ text: '\u{1F6AB} Отмена', c: 'menuUser' }],
    }
  await dbConnect()
  const user = await Users.findOneAndUpdate(
    { telegramId },
    {
      name: jsonCommand.message,
    }
  )
  return {
    success: true,
    message: 'Имя обновлено',
    nextCommand: `menuUser`,
  }
}

export default setUserName
