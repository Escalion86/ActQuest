import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import main_menu_button from './menuItems/main_menu_button'

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
      main_menu_button,
    ],
  }
}

export default menu_user
