import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const set_team_description = async ({ telegramId, message, props }) => {
  if (!message)
    return {
      success: false,
      message: 'Не удалось обновить описание команды, так как строка пуста',
      nextCommand: `/menu_teams`,
    }

  if (!props.teamId)
    return {
      success: false,
      message:
        'Не удалось изменить описание команды, так как команда не найдена',
      nextCommand: `/menu_teams`,
    }
  await dbConnect()
  const team = await Teams.findByIdAndUpdate(props.teamId, {
    description: message,
  })
  return { success: true, message: 'Описание команды обновлено' }
}

export default set_team_description
