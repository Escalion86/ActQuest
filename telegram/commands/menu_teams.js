const menu_teams = async ({ telegramId, message, props }) => {
  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      { command: 'create_team', text: '\u{2795} Создать команду' },
      // { command: 'edit_team', text: '\u{270F} Редактировать команду' },
      { command: 'joined_teams', text: '\u{1F465} Мои команды' },
      { command: 'join_team', text: '\u{1F517} Присоединиться к команде' },
      { command: 'main_menu', text: '\u{1F3E0} Главное меню' },
    ],
  }
}

export default menu_teams
