import { ADMIN_TELEGRAM_IDS, MODERS_TELEGRAM_IDS } from 'telegram/constants'

const mainMenu = async ({ telegramId }) => {
  const isAdmin = ADMIN_TELEGRAM_IDS.includes(telegramId)
  return {
    success: true,
    message: '<b>Главное меню</b>',
    buttons: [
      { c: 'menuGames', text: '\u{1F3AE} Игры' },
      { c: 'menuTeams', text: '\u{1F465} Команды' },
      { c: 'menuUser', text: '\u{1F464} Моя анкета' },
      {
        c: 'users',
        text: '\u{1F6E0} Пользователи без команд',
        hide: !isAdmin,
      },
      {
        c: 'teams',
        text: '\u{1F6E0} Обзор всех команд',
        hide: !isAdmin,
      },
      {
        c: 'menuGamesEdit',
        text: '\u{1F6E0} Конструктор игр',
        hide: !isAdmin && !MODERS_TELEGRAM_IDS.includes(telegramId),
      },
    ],
  }
}

export default mainMenu
