import Users from '@models/Users'

const setUserName = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand.message)
    return {
      success: true,
      message: 'Введите имя',
      buttons: [{ text: '\u{1F6AB} Отмена', c: 'menuUser' }],
    }
  const user = await Users.findOneAndUpdate(
    { telegramId },
    {
      name: jsonCommand.message,
    }
  )
  return {
    success: true,
    message: 'Имя обновлено',
    nextCommand: `menuUser`,
  }
}

export default setUserName
