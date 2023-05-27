import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import main_menu_button from './menuItems/main_menu_button'

const menuGamesEdit = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  // Получаем список игр
  const games = await Games.find({})

  return {
    message: 'Конструктор игр',
    buttons: [
      ...games.map((game) => ({
        text: `\u{270F} "${game.name}"`,
        cmd: { cmd: 'editGame', gameId: game._id },
        //`editGame/gameId=${game._id}`,
      })),
      { cmd: 'createGame', text: '\u{2795} Создать игру' },
      main_menu_button,
    ],
  }
}

export default menuGamesEdit
