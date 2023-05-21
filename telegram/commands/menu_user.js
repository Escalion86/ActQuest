import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

const menu_user = async ({ telegramId, message, props }) => {
  var user
  if (telegramId) {
    await dbConnect()
    user = await Users.findOne({ telegramId })
  }
  console.log('user :>> ', user)

  return {
    success: true,
    message: user ? `Моя анкета:\n - Имя:${user.name}` : 'Моя анкета',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      { text: 'Изменить имя', command: `set_user_name` },
      { text: '\u{2B05} Главное меню', command: 'main_menu' },
    ],
  }
}

export default menu_user
