import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const set_team_description = async ({ telegramId, message, props }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  if (!props.teamId)
    return {
      success: false,
      message:
        'Не удалось изменить описание команды, так как команда не найдена',
      nextCommand: `/menu_teams`,
    }
  if (!message) {
    return {
      success: true,
      message: 'Введите новое описание команды',
      buttons: [{ text: 'Отмена', command: 'menu_teams' }],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndUpdate(props.teamId, {
    description: message,
  })

  return {
    success: true,
    message: `Описание команды обновлена на "${message}"`,
    nextCommand: `/menu_teams`,
  }
}

export default set_team_description
