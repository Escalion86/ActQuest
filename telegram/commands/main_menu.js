const main_menu = async ({ telegramId, message, props }) => {
  console.log('!! main_menu')
  return {
    success: true,
    message: 'Главное меню',
    buttons: ['menu_teams', 'menu_user'],
  }
}

export default main_menu
