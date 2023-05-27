import mainMenuButton from './menuItems/mainMenuButton'

const menuTeams = async ({ telegramId, jsonCommand }) => {
  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    buttons: [
      // { command: 'editTeam', text: '\u{270F} Редактировать команду' },
      { cmd: 'joinedTeams', text: '\u{1F465} Мои команды' },
      { cmd: 'joinTeam', text: '\u{1F517} Присоединиться к команде' },
      { cmd: 'createTeam', text: '\u{2795} Создать команду' },
      mainMenuButton,
    ],
  }
}

export default menuTeams
