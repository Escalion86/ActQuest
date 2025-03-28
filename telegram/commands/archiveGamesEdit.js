import formatGameName from 'telegram/func/formatGameName'
import getNoun from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import isUserAdmin from '@helpers/isUserAdmin'

const archiveGamesEdit = async ({ telegramId, jsonCommand, user, db }) => {
  const isAdmin = isUserAdmin(user)

  // Получаем список игр
  var games = []
  if (isAdmin) games = await db.model('Games').find({})
  else games = await db.model('Games').find({ creatorTelegramId: telegramId })
  const finishedOrCanceledGames = games.filter(
    (game) => game.status === 'finished' || game.status === 'canceled'
  )

  const sortedGames = finishedOrCanceledGames.sort((a, b) => {
    return b.dateStart - a.dateStart
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(sortedGames, page, (game, number) => ({
    text: `\u{270F} ${formatGameName(game)}${game.hidden ? ` (СКРЫТА)` : ''}${
      game.status === 'canceled' ? ` (ОТМЕНЕНА)` : ''
    }`,
    c: { c: 'editGameGeneral', gameId: game._id },
    //`editGame/gameId=${game._id}`,
  }))

  return {
    message: `<b>Конструктор архива игр</b>\nВ списке отображены только ЗАВЕРШЕННЫЕ и только игры которые создали именно Вы\n\n<b>Количество игр в архиве</b>: ${getNoun(
      sortedGames.length,
      'игра',
      'игры',
      'игр'
    )}`,
    buttons: [...buttons, { c: 'menuGamesEdit', text: '\u{2B05} Назад' }],
  }
}

export default archiveGamesEdit
