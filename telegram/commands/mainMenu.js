import { ADMIN_TELEGRAM_ID } from 'telegram/constants'

const mainMenu = async ({ telegramId, jsonCommand }) => {
  return {
    success: true,
    message: '<b>Главное меню</b>',
    buttons: [
      { cmd: 'menuGames', text: '\u{1F3AE} Игры' },
      { cmd: 'menuTeams', text: '\u{1F465} Команды' },
      { cmd: 'menuUser', text: '\u{1F464} Моя анкета' },
      {
        cmd: 'teams',
        text: '\u{1F6E0} Обзор всех команд',
        hide: telegramId !== ADMIN_TELEGRAM_ID,
      },
      {
        cmd: 'menuGamesEdit',
        text: '\u{1F6E0} Конструктор игр',
        hide: telegramId !== ADMIN_TELEGRAM_ID,
      },
    ],
  }
}

export default mainMenu
