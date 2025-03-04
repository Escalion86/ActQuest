import check from 'telegram/func/check'

const setTeamName = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое название команды',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editTeam', teamId: jsonCommand.teamId },
        },
      ],
    }
  }
  const team = await db.model('Teams').findByIdAndUpdate(jsonCommand.teamId, {
    name: jsonCommand.message,
    name_lowered: jsonCommand.message.toLowerCase(),
  })

  return {
    success: true,
    message: `Название команды обновлена на "${jsonCommand.message}"`,
    nextCommand: { c: 'editTeam', teamId: jsonCommand.teamId },
  }
}

export default setTeamName
