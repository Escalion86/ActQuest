import check from 'telegram/func/check'
// import getSettings from 'telegram/func/getSettings'

const settingsSetChatUrl = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (jsonCommand.delete) {
    const newSteeings = await db.model('SiteSettings').findOneAndUpdate(
      {},
      {
        chatUrl: null,
      },
      {
        new: true,
        upsert: true,
      }
    )

    return {
      success: true,
      message: 'Ссылка на общий чат удалена',
      nextCommand: {
        c: 'settings',
      },
    }
  }

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите ссылку на чат',
      buttons: [
        {
          text: 'Без ссылки на чат',
          c: {
            delete: true,
          },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'settings' },
        },
      ],
    }
  }
  // const settings = await getSettings(db)

  const newSteeings = await db.model('SiteSettings').findOneAndUpdate(
    {},
    {
      chatUrl: jsonCommand.message,
    },
    {
      new: true,
      upsert: true,
    }
  )

  return {
    success: true,
    message: `Ссылка на чат обновлена`,
    nextCommand: { c: 'settings' },
  }
}

export default settingsSetChatUrl
