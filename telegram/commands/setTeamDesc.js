import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const setTeamDesc = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  if (jsonCommand.noDescription) {
    await dbConnect()
    const team = await Teams.findByIdAndUpdate(jsonCommand.teamId, {
      description: '',
    })
    return {
      success: true,
      message: 'Описание команды удалено',
      nextCommand: `menuTeams`,
    }
  }
  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое описание команды',
      buttons: [
        {
          text: 'Без описания',
          cmd: { noDescription: true },
          //`+noDescription=true`,
        },
        { text: '\u{1F6AB} Отмена', cmd: 'menuTeams' },
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
    nextCommand: `menuTeams`,
  }
}

export default setTeamDesc
