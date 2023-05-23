import main_menu_button from './menuItems/main_menu_button'

const menu_teams = async ({ telegramId, message, props }) => {
  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      // { command: 'edit_team', text: '\u{270F} Редактировать команду' },
      { command: 'joined_teams', text: '\u{1F465} Мои команды' },
      { command: 'join_team', text: '\u{1F517} Присоединиться к команде' },
      { command: 'create_team', text: '\u{2795} Создать команду' },
      main_menu_button,
    ],
  }
}

export default menu_teams
