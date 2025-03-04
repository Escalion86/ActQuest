import sendMessage from 'telegram/sendMessage'

const sendMessageToAll = async ({ telegramId, jsonCommand, location, db }) => {
  // const checkData = check(jsonCommand, ['gameId'])
  // if (checkData) return checkData

  // const game = await getGame(jsonCommand.gameId,db)
  // if (game.success === false) return game

  if (!jsonCommand.message) {
    return {
      message: `Напишите сообщение которое хотите отправить`,
      buttons: [
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'adminMenu' },
        },
      ],
    }
  }

  // Получаем список всех пользователей
  const users = await db.model('Users').find({})

  // Получаем telegramId всех пользователей
  const allUsersTelegramIds = users.map((user) => user.telegramId)

  // const keyboard = keyboardFormer([
  //   {
  //     c: { c: 'joinGame', gameId: jsonCommand.gameId },
  //     text: '\u{270F} Зарегистрироваться на игру',
  //   },
  //   mainMenuButton,
  // ])

  await Promise.all(
    allUsersTelegramIds.map(async (telegramId) => {
      await sendMessage({
        // images: game.image ? [game.image] : undefined,
        chat_id: telegramId,
        text: jsonCommand.message,
        // keyboard,
        location,
      })
    })
  )

  return {
    message: `Сообщение отправлено всем!`,
    nextCommand: { c: 'adminMenu' },
  }
}

export default sendMessageToAll
