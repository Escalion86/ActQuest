import isUserAdmin from '@helpers/isUserAdmin'
import isUserBan from '@helpers/isUserBan'
import isUserModer from '@helpers/isUserModer'
import getSettings from 'telegram/func/getSettings'

const mainMenu = async ({ telegramId, user, db }) => {
  const isAdmin = isUserAdmin(user)
  const isModer = isUserModer(user)
  const isBan = isUserBan(user)

  const settings = await getSettings(db)
  const chatUrl = settings?.chatUrl

  return {
    success: true,
    message: '<b>Главное меню</b>',
    buttons: [
      { c: 'menuGames', text: '\u{1F3AE} Игры' },
      { c: 'menuTeams', text: '\u{1F465} Команды', hide: isBan },
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
      {
        url: chatUrl,
        text: '\u{1F4AC} Общий чат ActQuest',
        hide: !chatUrl,
      },
    ],
  }
}

export default mainMenu
