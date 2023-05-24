import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const set_team_name = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  if (!jsonCommand.teamId)
    return {
      success: false,
      message:
        'Не удалось изменить название команды, так как команда не найдена',
      nextCommand: `menu_teams`,
    }
  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое название команды',
      buttons: [{ text: '\u{1F6AB} Отмена', cmd: 'menu_teams' }],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndUpdate(jsonCommand.teamId, {
    name: jsonCommand.message,
    name_lowered: jsonCommand.message.toLowerCase(),
  })

  return {
    success: true,
    message: `Название команды обновлена на "${jsonCommand.message}"`,
    nextCommand: `menu_teams`,
  }
}

export default set_team_name
