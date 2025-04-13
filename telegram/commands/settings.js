import isUserAdmin from '@helpers/isUserAdmin'
import getSettings from 'telegram/func/getSettings'

const settings = async ({ telegramId, jsonCommand, user, db }) => {
  const settings = getSettings(db)

  const isAdmin = isUserAdmin(user)

  return {
    message: '<b>Настройки движка</b>',
    buttons: [
      {
        c: 'settingsSetChatUrl',
        text: '\u{1F4E2} Изменить ссылку на чат в главном меню',
        hide: !isAdmin,
      },
      { c: 'adminMenu', text: '\u{2B05} Назад' },
    ],
  }
}

export default settings
