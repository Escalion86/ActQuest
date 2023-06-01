import { ADMIN_TELEGRAM_ID } from 'telegram/constants'

const mainMenu = async ({ telegramId, jsonCommand }) => {
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
        hide: telegramId !== ADMIN_TELEGRAM_ID,
      },
      {
        c: 'teams',
        text: '\u{1F6E0} Обзор всех команд',
        hide: telegramId !== ADMIN_TELEGRAM_ID,
      },
      {
        c: 'menuGamesEdit',
        text: '\u{1F6E0} Конструктор игр',
        hide: telegramId !== ADMIN_TELEGRAM_ID,
      },
    ],
  }
}

export default mainMenu
