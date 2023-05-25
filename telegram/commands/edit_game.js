import getGame from 'telegram/func/getGame'

const edit_game = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand?.gameId) {
    return {
      message: 'Ошибка. Нет id игры',
      nextCommand: `menu_games_edit`,
    }
  }

  const game = await getGame(jsonCommand.gameId)
  if (!game) {
    return {
      message: 'Ошибка. Нет игры с таким id',
      nextCommand: `menu_games_edit`,
    }
  }

  return {
    message: `Редактирование игры "${game?.name}".${
      game?.description ? `\nОписание: "${game?.description}"` : ''
    }`,
    buttons: [
      {
        cmd: { cmd: 'set_game_name', gameId: jsonCommand.gameId },
        text: '\u{270F} Изменить название',
      },
      {
        cmd: {
          cmd: 'set_game_desc',
          gameId: jsonCommand.gameId,
        },
        text: '\u{270F} Изменить описание',
      },
      {
        cmd: { cmd: 'game_teams', gameId: jsonCommand.gameId },
        text: '\u{1F465} Зарегистрированные команды',
      },
      {
        cmd: { cmd: 'delete_game', gameId: jsonCommand.gameId },
        text: '\u{1F4A3} Удалить игру',
      },
      { cmd: 'menu_games_edit', text: '\u{2B05} Назад' },
    ],
  }
}

export default edit_game
