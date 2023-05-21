import dbConnect from '@utils/dbConnect'
import createTeam from 'telegram/func/createTeam'

const create_team = async ({ telegramId, message, props }) => {
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
  // Если задаем имя
  if (!props.teamName) {
    return {
      success: true,
      message: `Задано название команды "${message}"`,
      nextCommand: `/create_team/teamName=${message}`,
    }
  }
  // Если имя уже задано
  const team = await createTeam(telegramId, props?.teamName, message)

  return { success: true, message: `Команда создана` }
}

export default create_team
