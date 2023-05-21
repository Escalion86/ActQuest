const menu_user = async ({ telegramId, message, props }) => {
  return {
    success: true,
    message: 'Моя анкета',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      { text: 'Изменить имя', command: `set_user_name` },
      { command: 'main_menu', text: '\u{2B05} Главное меню' },
    ],
  }
}

export default menu_user
