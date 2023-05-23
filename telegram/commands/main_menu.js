const main_menu = async ({ telegramId, message, props }) => {
  return {
    success: true,
    message: 'Главное меню',
    buttons: [
      { command: 'menu_games', text: '\u{1F3AE} Игры' },
      { command: 'menu_teams', text: '\u{1F465} Команды' },
      { command: 'menu_user', text: '\u{1F464} Моя анкета' },
      { command: 'menu_games_edit', text: '\u{1F6E0} Конструктор игр' },
    ],
  }
}

export default main_menu
