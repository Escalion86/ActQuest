const main_menu = async ({ telegramId, jsonCommand }) => {
  return {
    success: true,
    message: 'Главное меню',
    buttons: [
      { cmd: 'menu_games', text: '\u{1F3AE} Игры' },
      { cmd: 'menu_teams', text: '\u{1F465} Команды' },
      { cmd: 'menu_user', text: '\u{1F464} Моя анкета' },
      { cmd: 'menu_games_edit', text: '\u{1F6E0} Конструктор игр' },
    ],
  }
}

export default main_menu
