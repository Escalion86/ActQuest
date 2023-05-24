import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

const set_user_name = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand.message)
    return {
      success: true,
      message: 'Введите имя',
      buttons: [{ text: '\u{1F6AB} Отмена', command: 'menu_user' }],
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
    nextCommand: `menu_user`,
  }
}

export default set_user_name
