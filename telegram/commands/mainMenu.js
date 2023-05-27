const mainMenu = async ({ telegramId, jsonCommand }) => {
  return {
    success: true,
    message: 'Главное меню',
    buttons: [
      { cmd: 'menuGames', text: '\u{1F3AE} Игры' },
      { cmd: 'menuTeams', text: '\u{1F465} Команды' },
      { cmd: 'menuUser', text: '\u{1F464} Моя анкета' },
      {
        cmd: 'menuGamesEdit',
        text: '\u{1F6E0} Конструктор игр',
        hide: telegramId !== 261102161,
      },
    ],
  }
}

export default mainMenu
