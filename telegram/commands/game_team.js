import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const game_team = async ({ telegramId, jsonCommand }) => {
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

  const game = await getGame(jsonCommand?.gameId)
  if (!game || game.length === 0) {
    return {
      message: 'Ошибка. Игра не найдена',
      nextCommand: `menu_games_edit`,
    }
  }

  const team = await getTeam(gameTeam.teamId)
  if (!team || team.length === 0) {
    return {
      message: 'Ошибка. Не найдена команда зарегистрированная на игру',
      nextCommand: `menu_games_edit`,
    }
  }

  const buttons = [
    {
      cmd: {
        cmd: 'detach_game_team',
        gameTeamId: jsonCommand.gameTeamId,
      },
      text: '\u{1F4A3} Удалить команду из игры',
    },
    { cmd: 'menu_games_edit', text: '\u{2B05} Назад' },
  ]

  return {
    message: `Игра "${game.name}".\тКоманда "${team?.name}".${
      team?.description ? `\nОписание: "${team?.description}"` : ''
    }`,
    buttons,
  }
}

export default game_team
