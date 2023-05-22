import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

const menu_user = async ({ telegramId, message, props }) => {
  var user
  if (telegramId) {
    await dbConnect()
    user = await Users.findOne({ telegramId })
  }

  return {
    success: true,
    message: user ? `Моя анкета:\n - Имя: ${user.name}` : 'Моя анкета',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      { text: '\u{270F} Изменить имя', command: `set_user_name` },
      { text: '\u{1F3E0} Главное меню', command: 'main_menu' },
    ],
  }
}

export default menu_user
