import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const deleteGame = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление игры',
      buttons: [
        {
          text: '\u{1F4A3} Удалить',
          cmd: { confirm: true },
        },
        { text: '\u{1F6AB} Отмена', cmd: 'menuGamesEdit' },
      ],
    }
  }
  await dbConnect()
  const game = await Games.findByIdAndRemove(jsonCommand.gameId)
  const gamesTeams = await GamesTeams.deleteMany({ gameId: jsonCommand.gameId })
  return {
    success: true,
    message: 'Игра удалена',
    nextCommand: `menuGamesEdit`,
  }
}

export default deleteGame
