import userRoleName from '@helpers/userRoleName'
import check from 'telegram/func/check'

const userRoleChange = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['userTId'])
  if (checkData) return checkData

  const user = await db
    .model('Users')
    .findOne({ telegramId: jsonCommand.userTId })
    .lean()

  const roleName = userRoleName(user.role)

  if (!jsonCommand.role) {
    return {
      success: true,
      message: `Выберите роль пользователя "${user.name}"\n\nТекущая роль: ${roleName}`,
      buttons: [
        {
          text: '\u{26A1} Администратор',
          c: { role: 'admin' },
          hide: roleName === 'Администратор',
        },
        {
          text: '\u{26A1} Пользователь',
          c: { role: 'client' },
          hide: roleName === 'Пользователь',
        },
        {
          text: '\u{26A1} Бан',
          c: { role: 'ban' },
          hide: roleName === 'Бан',
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'userAdmin', userTId: jsonCommand.userTId },
        },
      ],
    }
  }

  await db
    .model('Users')
    .findByIdAndUpdate(user._id, { role: jsonCommand.role })

  return {
    success: true,
    message: `Роль пользователя "${user.name}" изменена на "${userRoleName(
      jsonCommand.role
    )}"`,
    nextCommand: { c: 'userAdmin', userTId: jsonCommand.userTId },
  }
}

export default userRoleChange
