import isUserAdmin from '@helpers/isUserAdmin'
import sendMessage from 'telegram/sendMessage'
import mainMenuButton from './menuItems/mainMenuButton'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const toPositiveInt = (value, fallback) => {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric)
  }
  return fallback
}

const requestUsersPhones = async ({ user, location, db, jsonCommand }) => {
  const isAdmin = isUserAdmin(user)

  if (!isAdmin) {
    return {
      success: false,
      message: 'Команда доступна только администраторам.',
      buttons: [mainMenuButton],
    }
  }

  const limit = toPositiveInt(
    jsonCommand?.limit || jsonCommand?.n || jsonCommand?.count,
    100,
  )

  const users = await db
    .model('Users')
    .find({
      telegramId: { $exists: true, $ne: null },
      $or: [{ phone: { $exists: false } }, { phone: null }],
    })
    .select({ telegramId: 1, name: 1, phone: 1 })
    .limit(limit)
    .lean()

  if (!users || users.length === 0) {
    return {
      success: true,
      message: 'Нет пользователей с telegramId и пустым phone.',
      buttons: [
        { c: 'adminMenu', text: '⬅️ Админ меню' },
        mainMenuButton,
      ],
    }
  }

  let sent = 0
  let failed = 0

  for (const userDoc of users) {
    const telegramId = Number(userDoc?.telegramId)

    if (!Number.isFinite(telegramId)) {
      failed += 1
      continue
    }

    try {
      await sendMessage({
        chat_id: telegramId,
        text:
          'Для продолжения работы в ActQuest нужно подтвердить номер телефона.\n\n' +
          'Нажмите кнопку ниже и отправьте ваш контакт из Telegram.',
        keyboard: {
          keyboard: [
            [
              {
                text: 'Отправить мой номер телефона',
                request_contact: true,
              },
            ],
          ],
          one_time_keyboard: true,
        },
        location,
      })

      sent += 1
    } catch (error) {
      failed += 1
    }

    // Мягкий троттлинг, чтобы не уткнуться в лимиты Telegram API.
    await delay(45)
  }

  return {
    success: true,
    message:
      `<b>Запрос номера завершен</b>\n` +
      `Отобрано: ${users.length}\n` +
      `Отправлено: ${sent}\n` +
      `Ошибки отправки: ${failed}\n\n` +
      `Подсказка: можно ограничить выборку через параметр limit, например /requestUsersPhones {"limit":50}.`,
    buttons: [
      { c: 'adminMenu', text: '⬅️ Админ меню' },
      mainMenuButton,
    ],
  }
}

export default requestUsersPhones
