import sendMessage from './sendMessage'

const checkUserData = async (telegramId, text, location, db) => {
  const user = await db.model('Users').findOne({
    telegramId,
  })

  if (!user) {
    if (text === '/start') {
      await sendMessage({
        chat_id: telegramId,
        text: 'Добро пожаловать в Act Quest!\nAct Quest - это телеграм бот, с помощью которого можно участвовать и проводить различные активные квесты',
        location,
      })
    }
    await sendMessage({
      chat_id: telegramId,
      // text: JSON.stringify({ body, headers: req.headers.origin }),
      text: 'Для регистрации НАЖМИТЕ КНОПКУ ВНИЗУ, это отправит ваши номер телефона и имя прописанные в учетной записи telegram.\nКнопка находится сразу под полем для ввода текста в чат, но если вы ее не видите, то справа от поля ввода текст нажмите на иконку в виде квадрата внутри которого находится еще 4 квадрата - это откроет кнопку для отправки данных',
      // props: { request_contact: true },
      keyboard: {
        keyboard: [
          [
            {
              text: 'Я КНОПКА - НАЖМИ МЕНЯ!, чтобы отправить данные',
              request_contact: true,
            },
          ],
        ],
        // resize_keyboard: true,
        one_time_keyboard: true,
      },
      location,
    })
    return false
  }
  return user
}

export default checkUserData
