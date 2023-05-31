import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import mainMenuButton from './menuItems/mainMenuButton'

const menuGamesEdit = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  // Получаем список игр
  const games = await Games.find({})

  return {
    message: '<b>Конструктор игр</b>',
    buttons: [
      ...games.map((game) => ({
        text: `\u{270F} "${game.name}"`,
        c: { c: 'editGame', gameId: game._id },
        //`editGame/gameId=${game._id}`,
      })),
      { c: 'createGame', text: '\u{2795} Создать игру' },
      mainMenuButton,
    ],
  }
}

export default menuGamesEdit
