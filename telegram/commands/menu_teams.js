const menu_teams = async ({ telegramId, message, props }) => {
  console.log('!! menu_teams')
  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      'create_team',
      'edit_team',
      'join_team',
      { command: 'main_menu', text: '\u{2B05} Главное меню' },
    ],
  }
}

export default menu_teams
