import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const set_team_name = async ({ telegramId, message, props }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  if (!props.teamId)
    return {
      success: false,
      message:
        'Не удалось изменить название команды, так как команда не найдена',
      nextCommand: `/menu_teams`,
    }
  if (!message) {
    return {
      success: true,
      message: 'Введите новое название команды',
      buttons: [{ text: '\u{1F6AB} Отмена', command: 'menu_teams' }],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndUpdate(props.teamId, {
    name: message,
    name_lowered: message.toLowerCase(),
  })

  return {
    success: true,
    message: `Название команды обновлена на "${message}"`,
    nextCommand: `/menu_teams`,
  }
}

export default set_team_name
