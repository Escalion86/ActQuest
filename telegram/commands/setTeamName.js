import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setTeamName = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое название команды',
      buttons: [{ text: '\u{1F6AB} Отмена', cmd: 'menuTeams' }],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndUpdate(jsonCommand.teamId, {
    name: jsonCommand.message,
    name_lowered: jsonCommand.message.toLowerCase(),
  })

  return {
    success: true,
    message: `Название команды обновлена на "${jsonCommand.message}"`,
    nextCommand: `menuTeams`,
  }
}

export default setTeamName
