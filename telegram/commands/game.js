import getGame from 'telegram/func/getGame'
import getTeamOfUserRegistredInAGame from 'telegram/func/getTeamOfUserRegistredInAGame'

const game = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand?.gameId) {
    return {
      message: 'Ошибка. Нет id игры',
      nextCommand: `menu_games`,
    }
  }

  const game = await getGame(jsonCommand.gameId)
  if (!game) {
    return {
      message: 'Ошибка. Нет игры с таким id',
      nextCommand: `menu_games`,
    }
  }

  const teamsInGame = getTeamOfUserRegistredInAGame(
    telegramId,
    jsonCommand.gameId
  )
  console.log('teamsInGame :>> ', teamsInGame)

  return {
    message: `Игра "${game?.name}".${
      game?.description ? `\nОписание: "${game?.description}"` : ''
    }${
      teamsInGame
        ? `Записана команда ${teamsInGame
            .map((team) => `"${team.name}"`)
            .join(', ')}`
        : ''
    }`,
    buttons: [
      {
        cmd: { cmd: 'join_game', gameId: jsonCommand.gameId },
        text: '\u{270F} Зарегистрироваться на игру',
        hide: teamsInGame,
      },
      {
        cmd: { cmd: 'detach_game', gameId: jsonCommand.gameId },
        text: '\u{270F} Отписаться от игры',
        hide: !teamsInGame,
      },
      { cmd: 'menu_games', text: '\u{2B05} Назад' },
    ],
  }
}

export default game
