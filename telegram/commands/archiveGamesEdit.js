import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import formatGameName from 'telegram/func/formatGameName'
import mainMenuButton from './menuItems/mainMenuButton'
import getNoun from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import isUserAdmin from '@helpers/isUserAdmin'

const archiveGamesEdit = async ({ telegramId, jsonCommand, user }) => {
  const isAdmin = isUserAdmin(user)

  // Получаем список игр
  var games = []
  if (isAdmin) games = await Games.find({})
  else games = await Games.find({ creatorTelegramId: telegramId })
  const finishedGames = games.filter((game) => game.status === 'finished')

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    finishedGames,
    page,
    (game, number) => ({
      text: `\u{270F} ${formatGameName(game)}`,
      c: { c: 'editGameGeneral', gameId: game._id },
      //`editGame/gameId=${game._id}`,
    })
  )

  return {
    message: `<b>Конструктор архива игр</b>\nВ списке отображены только ЗАВЕРШЕННЫЕ и только игры которые создали именно Вы\n\n<b>Количество игр в архиве</b>: ${getNoun(
      finishedGames.length,
      'игра',
      'игры',
      'игр'
    )}`,
    buttons: [...buttons, mainMenuButton],
  }
}

export default archiveGamesEdit
