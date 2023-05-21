import dbConnect from '@utils/dbConnect'
import createTeam from 'telegram/func/createTeam'

const create_team = async ({ telegramId, message, props }) => {
  await dbConnect()
  // Если задаем имя
  if (!message) {
    if (!props.teamName)
      return {
        success: true,
        message: 'Введите название команды',
        // nextCommand: `/menu_teams`,
      }

    // Если имя уже задано, значит сейчас идет ввод описания
    const team = await createTeam(telegramId, props?.teamName, message)

    return { success: true, message: `Команда "${props?.teamName}" создана` }
  }

  return {
    success: true,
    message: `Задано название команды "${message}"`,
    nextCommand: `/create_team/teamName=${message}`,
  }
}

export default create_team
