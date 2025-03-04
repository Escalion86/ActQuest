import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'
import mainMenuButton from './menuItems/mainMenuButton'
import keyboardFormer from 'telegram/func/keyboardFormer'
import gameDescription from '@helpers/gameDescription'

const gameAnonsMsg = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      message: `Подтвердите отправку анонса игры ${formatGameName(
        game
      )} всем подписчикам`,
      buttons: [
        {
          text: '\u{26A1} Отправить анонс всем!',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  // Получаем список всех пользователей
  const users = await db.model('Users').find({})

  const creator = game?.creatorTelegramId
    ? users.find((user) => user.telegramId == game?.creatorTelegramId)
    : undefined

  // Получаем telegramId всех пользователей
  const allUsersTelegramIds = users.map((user) => user.telegramId)

  const keyboard = keyboardFormer([
    ...(game.showCreator
      ? [
          {
            url: `t.me/+${creator?.phone}`,
            text: '\u{1F4AC} Написать орагнизатору',
            hide: !creator,
          },
        ]
      : []),
    {
      c: { c: 'joinGame', gameId: jsonCommand.gameId },
      text: '\u{270F} Зарегистрироваться на игру',
    },
    mainMenuButton,
  ])

  const text = `<b>АНОНС ИГРЫ</b>\n${gameDescription(game, creator)}`
  const images = game.image ? [game.image] : undefined

  await Promise.all(
    allUsersTelegramIds.map(async (telegramId) => {
      await sendMessage({
        images,
        chat_id: telegramId,
        text,
        keyboard,
        location,
      })
    })
  )

  return {
    message: `Анонс отправлен всем!`,
    nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
  }
}

export default gameAnonsMsg
