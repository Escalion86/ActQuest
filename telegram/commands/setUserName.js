const setUserName = async ({ telegramId, jsonCommand, location, db }) => {
  if (!jsonCommand.message)
    return {
      success: true,
      message: 'Введите имя',
      buttons: [{ text: '\u{1F6AB} Отмена', c: 'menuUser' }],
    }
  const user = await db.model('Users').findOneAndUpdate(
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
