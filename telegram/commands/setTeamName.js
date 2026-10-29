import check from 'telegram/func/check'
import {
  isTeamNameConflict,
  prepareRegularTeamName,
  TEAM_NAME_CONFLICT_MESSAGE,
} from '@server/teamNameUniqueness'

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
  const TeamsModel = db.model('Teams')
  const team = await TeamsModel.findById(jsonCommand.teamId).lean()
  if (!team || team.kind === 'personal') {
    return { success: false, message: 'Команда недоступна для изменения' }
  }
  try {
    const nameFields = await prepareRegularTeamName({
      TeamsModel,
      name: jsonCommand.message,
      location: team.location || location,
      teamId: jsonCommand.teamId,
    })
    await TeamsModel.findByIdAndUpdate(jsonCommand.teamId, { $set: nameFields })
  } catch (error) {
    if (!isTeamNameConflict(error)) throw error
    return {
      success: false,
      message: TEAM_NAME_CONFLICT_MESSAGE,
      nextCommand: { c: 'editTeam', teamId: jsonCommand.teamId },
    }
  }

  return {
    success: true,
    message: `Название команды обновлена на "${jsonCommand.message}"`,
    nextCommand: { c: 'editTeam', teamId: jsonCommand.teamId },
  }
}

export default setTeamName
