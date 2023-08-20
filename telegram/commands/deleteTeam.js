import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const deleteTeam = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  //TODO добавить проверку, что команда не играла

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление команды',
      buttons: [
        {
          text: '\u{1F4A3} Удалить',
          c: { confirm: true },
          // `deleteTeam` + propsToStr(props)
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editTeam', teamId: jsonCommand.teamId },
        },
      ],
    }
  }
  await dbConnect()
  const team = await Teams.findByIdAndRemove(jsonCommand.teamId)
  const teamUsers = await TeamsUsers.deleteMany({ teamId: jsonCommand.teamId })
  const gameTeams = await GamesTeams.deleteMany({ teamId: jsonCommand.teamId })
  return {
    success: true,
    message: 'Команда удалена',
    nextCommand: `menuTeams`,
  }
}

export default deleteTeam
