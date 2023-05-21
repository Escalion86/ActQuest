import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const set_team_description = async ({ telegramId, message, props }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  console.log('props.teamId :>> ', props.teamId)
  if (!props.teamId)
    return {
      success: false,
      message:
        'Не удалось изменить описание команды, так как команда не найдена',
      nextCommand: `/menu_teams`,
    }
  if (props.noDescription) {
    await dbConnect()
    const team = await Teams.findByIdAndUpdate(props.teamId, {
      description: '',
    })
    return {
      success: true,
      message: 'Описание команды удалено',
      nextCommand: `/menu_teams`,
    }
  }
  if (!message) {
    return {
      success: true,
      message: 'Введите новое описание команды',
      buttons: [
        {
          text: 'Без описания',
          command: `set_team_description/teamId=${props.teamId}/noDescription=true`,
        },
        { text: 'Отмена', command: 'menu_teams' },
      ],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndUpdate(props.teamId, {
    description: message,
  })

  return {
    success: true,
    message: `Описание команды обновлено на "${message}"`,
    nextCommand: `/menu_teams`,
  }
}

export default set_team_description
