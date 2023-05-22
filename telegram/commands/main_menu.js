const main_menu = async ({ telegramId, message, props }) => {
  return {
    success: true,
    message: 'Главное меню',
    buttons: [
      { command: 'menu_teams', text: '\u{1F465} Команды' },
      { command: 'menu_user', text: '\u{1F464} Моя анкета' },
    ],
  }
}

export default main_menu
