const menu_teams = async ({ telegramId, message, props }) => {
  console.log('!! menu_teams')
  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      { command: 'create_team', text: 'Создать команду' },
      { command: 'edit_team', text: 'Редактировать команду' },
      { command: 'joined_teams', text: 'Команды в которых я состою' },
      { command: 'join_team', text: 'Присоединиться к команде' },
      { command: 'main_menu', text: '\u{1F3E0} Главное меню' },
    ],
  }
}

export default menu_teams
