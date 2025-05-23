import mainMenuButton from './menuItems/mainMenuButton'

const menuUser = async ({ telegramId, jsonCommand, location, db }) => {
  var user
  if (telegramId) {
    user = await db.model('Users').findOne({ telegramId })
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
