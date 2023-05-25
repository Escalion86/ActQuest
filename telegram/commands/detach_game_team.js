import GamesTeams from '@models/GamesTeams'
import getGameTeam from 'telegram/func/getGameTeam'

const detach_game_team = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand?.gameTeamId)
    return {
      message: 'Ошибка. Не указан gameTeamId',
      nextCommand: `menu_games_edit`,
    }

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (!gameTeam || gameTeam.length === 0) {
    return {
      message: 'Ошибка. Не найдена регистрация команды на игре',
      nextCommand: `menu_games_edit`,
    }
  }

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление команды из игры',
      buttons: [
        {
          text: '\u{1F4A3} Удалить из команду из игры',
          cmd: { confirm: true },
        },
        { text: '\u{1F6AB} Отмена', cmd: 'menu_games_edit' },
      ],
    }
  }

  await GamesTeams.findByIdAndDelete(jsonCommand.gameTeamId)
  return {
    success: true,
    message: 'Команда удалена из игры',
    nextCommand: `menu_games_edit`,
  }
}

export default detach_game_team
