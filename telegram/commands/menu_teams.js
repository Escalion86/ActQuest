import main_menu_button from './menuItems/main_menu_button'

const menu_teams = async ({ telegramId, jsonCommand }) => {
  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    buttons: [
      // { command: 'edit_team', text: '\u{270F} Редактировать команду' },
      { cmd: 'joined_teams', text: '\u{1F465} Мои команды' },
      { cmd: 'join_team', text: '\u{1F517} Присоединиться к команде' },
      { cmd: 'create_team', text: '\u{2795} Создать команду' },
      main_menu_button,
    ],
  }
}

export default menu_teams
