import sendMessage from 'telegram/sendMessage'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'

const sendMessageToAll = async ({
  telegramId,
  jsonCommand,
  location,
  db,
  source,
}) => {
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

  const shouldSendToTelegram = source !== 'web'

  if (shouldSendToTelegram) {
    await Promise.all(
      allUsersTelegramIds.map(async (targetTelegramId) => {
        await sendMessage({
          chat_id: targetTelegramId,
          text: jsonCommand.message,
          location,
        })
      })
    )
  }

  let notificationResult = { created: 0, delivered: 0 }

  try {
    notificationResult = await broadcastNotificationToUsers({
      db,
      users,
      notification: {
        title: 'Сообщение от администратора',
        body: jsonCommand.message,
        url: `/cabinet?tab=notifications&location=${location}`,
        location,
        tag: `admin-broadcast-${Date.now()}`,
        data: {
          location,
          type: 'admin-broadcast',
          authorTelegramId: telegramId,
        },
      },
    })
  } catch (error) {
    console.error('Broadcast PWA notifications error', error)
  }

  const telegramSummary = shouldSendToTelegram
    ? `Telegram: отправлено ${allUsersTelegramIds.length}.`
    : 'Telegram-рассылка отключена для веб-кабинета.'

  return {
    message: `Сообщение отправлено всем!\n${telegramSummary}\nPWA уведомления: создано ${notificationResult.created}, доставлено ${notificationResult.delivered}.`,
    nextCommand: { c: 'adminMenu' },
  }
}

export default sendMessageToAll
