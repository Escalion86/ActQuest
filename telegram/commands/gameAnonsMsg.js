import secondsToTimeStr from '@helpers/secondsToTimeStr'
import Users from '@models/Users'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'
import mainMenuButton from './menuItems/mainMenuButton'
import keyboardFormer from 'telegram/func/keyboardFormer'
import { getNounPoints } from '@helpers/getNoun'

const gameAnonsMsg = async ({ telegramId, jsonCommand, domen }) => {
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
          c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  // Получаем список всех пользователей
  const users = await Users.find({})

  const creator = game?.creatorTelegramId
    ? users.find((user) => user.telegramId == game?.creatorTelegramId)
    : undefined

  // Получаем telegramId всех пользователей
  const allUsersTelegramIds = users.map((user) => user.telegramId)

  const keyboard = keyboardFormer([
    {
      url: `t.me/+${creator?.phone}`,
      text: '\u{1F4AC} Написать орагнизатору',
      hide: !creator,
    },
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
        text: `<b>АНОНС ИГРЫ\n"${game?.name}"</b>\n\n<b>Дата и время</b>: ${
          game.dateStart
            ? moment(game.dateStart)
                .tz('Asia/Krasnoyarsk')
                .format('DD.MM.yyyy H:mm')
            : '[не заданы]'
        }\n\n<b>Тип игры</b>: ${
          game.type === 'photo' ? `\u{1F4F7} Фотоквест` : `\u{1F697} Классика`
        }* (см. подробнее внизу)\n\n<b>Описание</b>:\n${
          game?.description ? `"${game?.description}"` : '[без описания]'
        }\n\n<b>Количество заданий</b>: ${
          game?.tasks?.length ?? 0
        }\n<b>Максимальная продолжительность одного задания</b>: ${secondsToTimeStr(
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
            : game.type === 'photo'
            ? getNounPoints(game?.taskFailurePenalty)
            : secondsToTimeStr(game?.taskFailurePenalty)
        }${
          creator ? `\n\n<b>Организатор игры</b>: ${creator.name}` : ''
        }\n\n* - тип игры ${
          game.type === 'photo'
            ? '"Фотоквест" - в качестве ответа на задание должно быть изображение. За каждое выполненное, а также дополнительные задания начисляются баллы. Побеждает команда набравшая больше всех баллов'
            : '"Классика" - в качестве ответа на задание должен быть какой-либо текст. Побеждает та команда, которая выполнит задания быстрее всех с учетом бонусов и штрафов по времени'
        }`,
        keyboard,
        domen,
      })
    })
  )

  return {
    message: `Анонс отправлен всем!`,
    nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
  }
}

export default gameAnonsMsg
