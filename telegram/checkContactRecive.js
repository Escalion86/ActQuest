import executeCommand from './func/executeCommand'
import sendMessage from './sendMessage'
import upsertGlobalUser from '@helpers/upsertGlobalUser'

const checkContactRecive = async (message, location, db) => {
  if (!message?.contact) return true
  const { contact, from } = message
  if (contact) {
    const { phone_number, first_name, last_name, user_id } = contact
    if (Number(user_id) !== Number(from?.id)) {
      await sendMessage({
        chat_id: from?.id,
        text: 'Нужно отправить именно ваш контакт из Telegram.',
        location,
      })
      return false
    }

    const name = (first_name + (last_name ? ' ' + last_name : '')).trim()

    const globalUser = await upsertGlobalUser({
      telegramId: from.id,
      updates: {
        name,
        phone: Number(phone_number),
        currentLocation: location,
      },
      authMethod: 'telegram',
      setOnInsert: { accountLocation: location },
    })

    const user = await db.model('Users').findOneAndUpdate(
      {
        telegramId: from.id,
      },
      {
        name,
        phone: Number(phone_number),
        ...(globalUser?._id ? { globalUserId: globalUser._id.toString() } : {}),
      },
      { upsert: true }
    )

    await sendMessage({
      chat_id: user_id,
      text: `Регистрация успешна! Ваши данные:\n - Имя: ${name}\n - Телефон: ${phone_number}`,
      // keyboard: {
      //   keyboard: [],
      //   inline_keyboard: [
      //     [{ text: 'Изменить имя', callback_data: `/setUserName` }],
      //     [{ text: '\u{1F3E0} Главное меню', callback_data: `/mainMenu` }],
      //   ],
      // },
      remove_keyboard: true,
      location,
    })

    await executeCommand({
      userTelegramId: user_id,
      jsonCommand: { c: 'mainMenu' },
      location,
      user,
      db,
    })

    return false
  }
  return true
}

export default checkContactRecive
