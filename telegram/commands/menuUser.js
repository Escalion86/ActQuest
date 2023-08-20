import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import mainMenuButton from './menuItems/mainMenuButton'

const menuUser = async ({ telegramId, jsonCommand }) => {
  var user
  if (telegramId) {
    await dbConnect()
    user = await Users.findOne({ telegramId })
  }

  return {
    success: true,
    message: `<b>Моя анкета</b>${user ? `:\n - <b>Имя</b>: ${user.name}` : ''}`,
    buttonText: 'Команды',
    buttons: [
      { text: '\u{270F} Изменить имя', c: `setUserName` },
      mainMenuButton,
    ],
  }
}

export default menuUser
