import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'

const set_game_name = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  if (!jsonCommand.gameId)
    return {
      success: false,
      message: 'Не удалось изменить название игры, так как id игры не задан',
      nextCommand: `menu_games_edit`,
    }
  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое название игры',
      buttons: [{ text: '\u{1F6AB} Отмена', cmd: 'menu_games_edit' }],
    }
  }
  await dbConnect()
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    name: jsonCommand.message,
  })

  return {
    success: true,
    message: `Название игры обновлена на "${jsonCommand.message}"`,
    nextCommand: `menu_games_edit`,
  }
}

export default set_game_name
