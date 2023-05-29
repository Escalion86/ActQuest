import formatDateTime from '@helpers/formatDateTime'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editGame = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  return {
    images: game.image ? [game.image] : undefined,
    message: `Редактирование игры "${game?.name}".\nОписание: ${
      game?.description ? `"${game?.description}"` : '[без описания]'
    }\nКоличество заданий: ${
      game?.tasks?.length ?? '0'
    }\nДата и время: ${formatDateTime(
      game.dateStart,
      true,
      false,
      true,
      false,
      false,
      true,
      true
    )}`,
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
          cmd: 'gameTasksEdit',
          gameId: jsonCommand.gameId,
        },
        text: '\u{270F} Редактировать задания',
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
