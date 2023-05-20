import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import sendMessage from './sendMessage'

const checkUserData = async (telegramId) => {
  await dbConnect()
  const user = await Users.findOne({
    telegramId,
  })

  if (!user) {
    await sendMessage({
      chat_id: telegramId,
      // text: JSON.stringify({ body, headers: req.headers.origin }),
      text: 'Для регистрации необходимо предоставить данные (номер телефона и имя). Пожалуйста нажмите на кнопку внизу и подтвердите отправку данных.',
      // props: { request_contact: true },
      keyboard: {
        keyboard: [[{ text: 'Отправить данные', request_contact: true }]],
        // resize_keyboard: true,
        one_time_keyboard: true,
      },
    })
    return false
  }
  return true
}

export default checkUserData
