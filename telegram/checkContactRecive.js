import Users from '@models/Users'
// import dbConnect from '@utils/dbConnect'
import executeCommand from './func/executeCommand'
import sendMessage from './sendMessage'

const checkContactRecive = async (body) => {
  // Проверяем не отправлен ли нам контакт
  const contact = body?.message?.contact
  if (contact) {
    console.log('body :>> ', body)
    // await dbConnect() // TODO: Нужно ли это?
    const { phone_number, first_name, last_name, user_id } = contact
    const name = (first_name + (last_name ? ' ' + last_name : '')).trim()
    const user = await Users.findOneAndUpdate(
      {
        telegramId: body?.message?.from.id,
      },
      {
        name,
        phone: Number(phone_number),
      },
      { upsert: true }
    )

    await sendMessage({
      chat_id: user_id,
      text: `Регистрация успешна! Ваши данные:\n - Имя: ${name}\n - Телефон: +${phone_number}`,
      // keyboard: {
      //   keyboard: [],
      //   inline_keyboard: [
      //     [{ text: 'Изменить имя', callback_data: `/setUserName` }],
      //     [{ text: '\u{1F3E0} Главное меню', callback_data: `/mainMenu` }],
      //   ],
      // },
      remove_keyboard: true,
    })

    await executeCommand(user_id, { c: 'mainMenu' })

    return false
  }
  return true
}

export default checkContactRecive
