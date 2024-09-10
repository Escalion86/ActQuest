import isUserAdmin from '@helpers/isUserAdmin'
import isUserModer from '@helpers/isUserModer'

const mainMenu = async ({ telegramId, user }) => {
  const isAdmin = isUserAdmin(user)
  const isModer = isUserModer(user)

  return {
    success: true,
    message: '<b>Главное меню</b>',
    buttons: [
      { c: 'menuGames', text: '\u{1F3AE} Игры' },
      { c: 'menuTeams', text: '\u{1F465} Команды' },
      { c: 'menuUser', text: '\u{1F464} Моя анкета' },
      {
        c: 'menuGamesEdit',
        text: '\u{1F6E0} Конструктор игр',
        hide: !isModer,
      },
      {
        c: 'adminMenu',
        text: '\u{26A1} Меню АДМИНИСТРАТОРА',
        hide: !isAdmin,
      },
    ],
  }
}

export default mainMenu
