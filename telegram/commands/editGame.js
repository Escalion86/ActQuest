import formatDateTime from '@helpers/formatDateTime'
import dbConnect from '@utils/dbConnect'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editGame = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  return {
    images: game.image ? [game.image] : undefined,
    message: `${game.hidden ? '(ИГРА СКРЫТА!) ' : ''}Редактирование игры "${
      game?.name
    }"\nДата и время: ${moment(game.dateStart)
      .tz('Asia/Krasnoyarsk')
      .format('DD.MM.yyyy H:mm')}\nОписание: ${
      game?.description ? `"${game?.description}"` : '[без описания]'
    }\nКоличество заданий: ${game?.tasks?.length ?? '0'}`,
    buttons: [
      {
        cmd: { cmd: 'setGameName', gameId: jsonCommand.gameId },
        text: '\u{270F} Изменить название',
      },
      {
        cmd: {
          cmd: 'setGameDesc',
          gameId: jsonCommand.gameId,
        },
        text: '\u{270F} Изменить описание',
      },
      {
        cmd: {
          cmd: 'setGameDate',
          gameId: jsonCommand.gameId,
        },
        text: '\u{270F} Изменить дату и время',
      },
      {
        cmd: {
          cmd: 'gameTasksEdit',
          gameId: jsonCommand.gameId,
        },
        text: '\u{270F} Редактировать задания',
      },
      {
        cmd: {
          cmd: 'hideGame',
          gameId: jsonCommand.gameId,
        },
        text: '\u{1F648} Скрыть',
        hide: game.hidden,
      },
      {
        cmd: {
          cmd: 'unhideGame',
          gameId: jsonCommand.gameId,
        },
        text: '\u{1F441} Отобразить',
        hide: !game.hidden,
      },
      {
        cmd: { cmd: 'deleteGame', gameId: jsonCommand.gameId },
        text: '\u{1F4A3} Удалить игру',
      },
      { cmd: 'menuGamesEdit', text: '\u{2B05} Назад' },
    ],
  }
}

export default editGame
