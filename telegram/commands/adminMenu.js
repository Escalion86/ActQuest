import mainMenuButton from './menuItems/mainMenuButton'
import isUserAdmin from '@helpers/isUserAdmin'

const adminMenu = async ({ telegramId, user }) => {
  const isAdmin = isUserAdmin(user)
  return {
    success: true,
    message: '<b>Меню АДМИНИСТРАТОРА</b>',
    buttons: [
      {
        c: 'allUsers',
        text: '\u{1F464} Все пользователи',
        hide: !isAdmin,
      },
      {
        c: 'users',
        text: '\u{1F464} Пользователи без команд',
        hide: !isAdmin,
      },
      {
        c: 'teams',
        text: '\u{1F465} Все команды',
        hide: !isAdmin,
      },
      {
        c: 'sendMessageToAll',
        text: '\u{1F4E2} Отправить сообщение всем пользователям',
        hide: !isAdmin,
      },
      mainMenuButton,
    ],
  }
}

export default adminMenu
