import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import mainMenu_button from './menuItems/mainMenu_button'

const menuUser = async ({ telegramId, jsonCommand }) => {
  var user
  if (telegramId) {
    await dbConnect()
    user = await Users.findOne({ telegramId })
  }

  return {
    success: true,
    message: user ? `Моя анкета:\n - Имя: ${user.name}` : 'Моя анкета',
    buttonText: 'Команды',
    buttons: [
      { text: '\u{270F} Изменить имя', cmd: `setUserName` },
      mainMenu_button,
    ],
  }
}

export default menuUser
