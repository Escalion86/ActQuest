const menu_user = async ({ telegramId, message, props }) => {
  console.log('!! menu_user')
  return {
    success: true,
    message: 'Моя анкета',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      { text: 'Изменить имя', command: `set_user_name` },
      { text: '\u{2B05} Главное меню', command: 'main_menu' },
    ],
  }
}

export default menu_user
