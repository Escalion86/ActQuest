import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const set_game_name = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

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
