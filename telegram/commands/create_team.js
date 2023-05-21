import dbConnect from '@utils/dbConnect'
import createTeam from 'telegram/func/createTeam'

const create_team = async ({ telegramId, message, props }) => {
  await dbConnect()
  // Если задаем имя
  if (!props.teamName) {
    if (!message)
      return {
        success: false,
        message: 'Не удалось обновить название команды, так как строка пуста',
        nextCommand: `/menu_teams`,
      }
    return {
      success: true,
      message: `Задано название команды "${message}"`,
      nextCommand: `/create_team/teamName=${message}`,
    }
  }
  // Если имя уже задано, значит сейчас идет ввод описания
  const team = await createTeam(telegramId, props?.teamName, message)

  return { success: true, message: `Команда "${props?.teamName}" создана` }
}

export default create_team
