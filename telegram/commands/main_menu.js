const main_menu = async ({ telegramId, message, props }) => {
  console.log('!! main_menu')
  return {
    success: true,
    message: 'Главное меню',
    buttons: [
      { command: 'menu_teams', text: 'Команды' },
      { command: 'menu_user', text: 'Моя анкета' },
    ],
  }
}

export default main_menu
