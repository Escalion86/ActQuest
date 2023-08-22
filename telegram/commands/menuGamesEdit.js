import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import formatGameName from 'telegram/func/formatGameName'
import mainMenuButton from './menuItems/mainMenuButton'
import getNoun from '@helpers/getNoun'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const menuGamesEdit = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  // Получаем список игр
  const games = await Games.find({ creatorTelegramId: telegramId })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(games, page, (game, number) => ({
    text: `\u{270F} ${formatGameName(game)}`,
    c: { c: 'editGame', gameId: game._id },
    //`editGame/gameId=${game._id}`,
  }))

  return {
    message: `<b>Конструктор игр</b>\nВ списке отображены только игры которые создали именно Вы\n\n<b>Количество игр</b>: ${getNoun(
      games.length,
      'игра',
      'игры',
      'игр'
    )}`,
    buttons: [
      ...buttons,
      { c: 'createGame', text: '\u{2795} Создать игру' },
      mainMenuButton,
    ],
  }
}

export default menuGamesEdit
