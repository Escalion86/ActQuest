import formatGameName from 'telegram/func/formatGameName'
import getNoun from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import isUserAdmin from '@helpers/isUserAdmin'
import isArchiveGame from '@helpers/isArchiveGame'

const archiveGamesEdit = async ({ telegramId, jsonCommand, user, db }) => {
  const isAdmin = isUserAdmin(user)

  // Получаем список игр
  var games = []
  if (isAdmin) games = await db.model('Games').find({})
  else games = await db.model('Games').find({ creatorTelegramId: telegramId })
  const archiveGames = games.filter((game) => isArchiveGame(game))

  const sortedArchiveGames = archiveGames.sort((a, b) => {
    return b.dateStart - a.dateStart
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    sortedArchiveGames,
    page,
    (game, number) => ({
      text: `${number}. ${formatGameName(game)}${
        game.hidden ? ` (СКРЫТА)` : ''
      }${game.status === 'canceled' ? ` (ОТМЕНЕНА)` : ''}`,
      c: { c: 'editGameGeneral', gameId: game._id },
      //`editGame/gameId=${game._id}`,
    })
  )

  return {
    message: `<b>Конструктор архива игр</b>\nВ списке отображены только ЗАВЕРШЕННЫЕ и только игры которые создали именно Вы\n\n<b>Количество игр в архиве</b>: ${getNoun(
      sortedArchiveGames.length,
      'игра',
      'игры',
      'игр'
    )}`,
    buttons: [...buttons, { c: 'menuGamesEdit', text: '\u{2B05} Назад' }],
  }
}

export default archiveGamesEdit
