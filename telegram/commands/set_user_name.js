import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

const set_user_name = async ({ telegramId, message, props }) => {
  if (!message)
    return {
      success: true,
      message: 'Введите имя',
      buttons: [{ text: '\u{1F6AB} Отмена', command: 'menu_user' }],
    }
  await dbConnect()
  const user = await Users.findOneAndUpdate(
    { telegramId },
    {
      name: message,
    }
  )
  return {
    success: true,
    message: 'Имя обновлено',
    nextCommand: `/menu_user`,
  }
}

export default set_user_name
