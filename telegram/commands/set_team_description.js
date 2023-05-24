import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const set_team_description = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  if (!jsonCommand.teamId)
    return {
      success: false,
      message:
        'Не удалось изменить описание команды, так как команда не найдена',
      nextCommand: `menu_teams`,
    }
  if (jsonCommand.noDescription) {
    await dbConnect()
    const team = await Teams.findByIdAndUpdate(jsonCommand.teamId, {
      description: '',
    })
    return {
      success: true,
      message: 'Описание команды удалено',
      nextCommand: `menu_teams`,
    }
  }
  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое описание команды',
      buttons: [
        {
          text: 'Без описания',
          command: { noDescription: true },
          //`+noDescription=true`,
        },
        { text: '\u{1F6AB} Отмена', command: 'menu_teams' },
      ],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndUpdate(jsonCommand.teamId, {
    description: jsonCommand.message,
  })

  return {
    success: true,
    message: `Описание команды обновлено на "${jsonCommand.message}"`,
    nextCommand: `menu_teams`,
  }
}

export default set_team_description
