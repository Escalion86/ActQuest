import formatGameName from 'telegram/func/formatGameName'
import mainMenuButton from './menuItems/mainMenuButton'
import getNoun from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import isUserAdmin from '@helpers/isUserAdmin'
import isArchiveGame from '@helpers/isArchiveGame'

const menuGamesEdit = async ({ telegramId, jsonCommand, user, db }) => {
  const isAdmin = isUserAdmin(user)

  // Получаем список игр
  var games = []
  if (isAdmin) games = await db.model('Games').find({})
  else games = await db.model('Games').find({ creatorTelegramId: telegramId })
  const archiveGames = games.filter((game) => isArchiveGame(game))
  const notArchiveGames = games.filter((game) => !isArchiveGame(game))

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    notArchiveGames,
    page,
    (game, number) => ({
      text: `\u{270F} ${formatGameName(game)}${game.hidden ? ` (СКРЫТА)` : ''}${
        game.status === 'canceled' ? ` (ОТМЕНЕНА)` : ''
      }`,
      c: { c: 'editGameGeneral', gameId: game._id },
      //`editGame/gameId=${game._id}`,
    })
  )

  return {
    message: `<b>Конструктор игр</b>\nВ списке отображены только игры которые создали именно Вы\n\n<b>Количество игр</b>: ${getNoun(
      notArchiveGames.length,
      'игра',
      'игры',
      'игр'
    )}${
      archiveGames?.length > 0
        ? ` (в архиве ${getNoun(
            finishedOrCanceledGames.length,
            'игра',
            'игры',
            'игр'
          )})`
        : ''
    }`,
    buttons: [
      ...buttons,
      ...(archiveGames?.length > 0
        ? [{ c: 'archiveGamesEdit', text: '\u{1F4DA} Архив игр' }]
        : []),
      { c: 'createGame', text: '\u{2795} Создать игру' },
      mainMenuButton,
    ],
  }
}

export default menuGamesEdit
