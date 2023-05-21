import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

const set_user_name = async ({ telegramId, message }) => {
  if (!message)
    return {
      success: false,
      message: 'Не удалось обновить имя, так как строка пуста',
      nextCommand: `/menu_user`,
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
