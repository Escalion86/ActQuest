import mainMenuButton from './menuItems/mainMenuButton'

const menuUser = async ({ telegramId, jsonCommand, location, db }) => {
  var user
  if (telegramId) {
    user = await db.model('Users').findOne({ telegramId })
  }

  const message = user
    ? `<b>Моя анкета</b>

- <b>Имя</b>: ${user.name}`
    : '<b>Моя анкета</b>'

  return {
    success: true,
    message,
    buttonText: 'Команды',
    buttons: [
      { text: '\u{270F} Изменить имя', c: `setUserName` },
      mainMenuButton,
    ],
  }
}

export default menuUser
