import Teams from '@models/Teams'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setTeamDesc = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  if (jsonCommand.noDescription) {
    // await dbConnect() // TODO: Нужно ли это?
    const team = await Teams.findByIdAndUpdate(jsonCommand.teamId, {
      description: '',
    })
    return {
      success: true,
      message: 'Описание команды удалено',
      nextCommand: { c: 'editTeam', teamId: jsonCommand.teamId },
    }
  }
  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое описание команды',
      buttons: [
        {
          text: 'Без описания',
          c: { noDescription: true },
          //`+noDescription=true`,
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editTeam', teamId: jsonCommand.teamId },
        },
      ],
    }
  }
  // await dbConnect() // TODO: Нужно ли это?
  const team = await Teams.findByIdAndUpdate(jsonCommand.teamId, {
    description: jsonCommand.message,
  })

  return {
    success: true,
    message: `Описание команды обновлено на "${jsonCommand.message}"`,
    nextCommand: { c: 'editTeam', teamId: jsonCommand.teamId },
  }
}

export default setTeamDesc
