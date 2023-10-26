import { ADMIN_TELEGRAM_IDS, MODERS_TELEGRAM_IDS } from 'telegram/constants'
import mainMenuButton from './menuItems/mainMenuButton'

const adminMenu = async ({ telegramId }) => {
  const isAdmin = ADMIN_TELEGRAM_IDS.includes(telegramId)
  return {
    success: true,
    message: '<b>Меню АДМИНИСТРАТОРА</b>',
    buttons: [
      {
        c: 'allUsers',
        text: '\u{1F6E0} Все пользователи',
        hide: !isAdmin,
      },
      {
        c: 'users',
        text: '\u{1F6E0} Пользователи без команд',
        hide: !isAdmin,
      },
      {
        c: 'teams',
        text: '\u{1F6E0} Все команды',
        hide: !isAdmin,
      },
      mainMenuButton,
    ],
  }
}

export default adminMenu
