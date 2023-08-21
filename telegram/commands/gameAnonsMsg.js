import secondsToTimeStr from '@helpers/secondsToTimeStr'
import Users from '@models/Users'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'
import mainMenuButton from './menuItems/mainMenuButton'
import keyboardFormer from 'telegram/func/keyboardFormer'

const gameAnonsMsg = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
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
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  // Получаем список всех пользователей
  const users = await Users.find({})

  // Получаем telegramId всех пользователей
  const allUsersTelegramIds = users.map((user) => user.telegramId)

  const keyboard = keyboardFormer([
    {
      c: { c: 'joinGame', gameId: jsonCommand.gameId },
      text: '\u{270F} Зарегистрироваться на игру',
    },
    mainMenuButton,
  ])

  await Promise.all(
    allUsersTelegramIds.map(async (telegramId) => {
      await sendMessage({
        images: game.image ? [game.image] : undefined,
        chat_id: telegramId,
        text: `<b>АНОНС ИГРЫ "${game?.name}"</b>\n\n<b>Дата и время</b>:\n${
          game.dateStart
            ? moment(game.dateStart)
                .tz('Asia/Krasnoyarsk')
                .format('DD.MM.yyyy H:mm')
            : '[не заданы]'
        }\n\n<b>Описание</b>:\n${
          game?.description ? `"${game?.description}"` : '[без описания]'
        }\n\n<b>Количество заданий</b>: ${
          game?.tasks?.length ?? 0
        }\n<b>Продолжительность одного задания</b>: ${secondsToTimeStr(
          game?.taskDuration ?? 3600
        )}\n<b>Время до подсказки</b>: ${secondsToTimeStr(
          game?.cluesDuration ?? 1200
        )}\n<b>Перерыв между заданиями</b>: ${
          !game?.breakDuration
            ? 'отсутствует'
            : secondsToTimeStr(game?.breakDuration)
        }\n<b>Штраф за невыполнение задания</b>: ${
          !game?.taskFailurePenalty
            ? 'отсутствует'
            : secondsToTimeStr(game?.taskFailurePenalty)
        }\n\n<b>Организатор игры</b>: <a href="tg://user?id=261102161">Алексей Белинский</a> (кликните, чтобы написать организатору)`,
        keyboard,
      })
    })
  )

  return {
    message: `Анонс отправлен всем!`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default gameAnonsMsg
