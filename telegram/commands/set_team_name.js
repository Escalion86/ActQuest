import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const set_team_name = async ({ telegramId, message, props }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  if (!message)
    return {
      success: false,
      message: 'Не удалось обновить название команды, так как строка пуста',
      nextCommand: `/menu_teams`,
    }

  if (!props.teamId)
    return {
      success: false,
      message:
        'Не удалось изменить название команды, так как команда не найдена',
      nextCommand: `/menu_teams`,
    }
  await dbConnect()
  const team = await Teams.findByIdAndUpdate(props.teamId, {
    name: message,
    name_lowered: message.toLowerCase(),
  })
  return {
    success: true,
    message: 'Название команды обновлено',
    nextCommand: `/menu_teams`,
  }
}

export default set_team_name
